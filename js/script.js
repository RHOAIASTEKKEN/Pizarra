// Elementos del DOM
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const sizeSelector = document.getElementById('sizeSelector');
const colorPicker = document.getElementById('colorPicker');
const backgroundInput = document.getElementById('backgroundInput');
const equationEditor = document.getElementById('equationEditor');
const equationPreview = document.getElementById('equationPreview');
const backgroundImage = document.getElementById('backgroundImage');
const marker = document.getElementById('marker');

let isMarkerActive = false;

// Activar el plumón
marker.addEventListener('click', () => {
    isMarkerActive = true;
});

// Cambiar la opacidad al escribir con el plumón
canvas.addEventListener('mousemove', (e) => {
    if (isMarkerActive && e.buttons === 1) { // Solo si el plumón está activo y se está presionando el mouse
        ctx.globalAlpha = 0.2; // Cambia la opacidad del trazo
        // Aquí va el código de dibujo
    }
});

// Volver a la opacidad normal al dejar de usar el plumón
canvas.addEventListener('mouseup', () => {
    if (isMarkerActive) {
        ctx.globalAlpha = 1; // Restablece la opacidad normal
    }
});

// Variables globales
let drawing = false;
let tool = 'pencil';
let size = 5;
let color = '#000000';
let startX, startY;
let drawingActions = [];
let selectedObject = null;
let offsetX, offsetY;
let isPositioningEquation = false;
let equationToInsert = null;
let equationSize = 2;

// Configurar MathQuill
var MQ = MathQuill.getInterface(2);
var mathField = MQ.MathField(document.getElementById('mathField'), {
    spaceBehavesLikeTab: true,
    handlers: {
        edit: function () {
            updateEquationPreview();
        }
    }
});

// Funciones de inicialización
function resizeCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * 0.9 * pixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = (window.innerHeight * 0.9) + 'px';
    ctx.scale(pixelRatio, pixelRatio);
    redrawCanvas();
}

document.getElementById('equationSizeInput').addEventListener('input', (e) => {
    equationSize = parseFloat(e.target.value);
});

function loadBackgroundImage() {
    const savedImage = localStorage.getItem('backgroundImage');
    if (savedImage) {
        backgroundImage.src = savedImage;
    }
}

// Funciones de dibujo
function drawAction(action) {
    ctx.globalAlpha = action.tool === 'marker' ? 0.2 : 1;
    if (action.tool === 'equation') {
        ctx.drawImage(action.img, action.x, action.y, action.width, action.height);
    } else {
        if (action.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(action.startX, action.startY);
        ctx.lineTo(action.endX, action.endY);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over'; // Restablecer el modo de composición
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingActions.forEach(action => {
        if (action.tool === 'equation') {
            ctx.drawImage(action.img, action.x, action.y, action.width, action.height);
        } else {
            drawAction(action);
        }
    });
}

// Funciones de manejo de eventos
function startDrawing(e) {
    if (isPositioningEquation) {
        insertEquationAtPosition(e.offsetX, e.offsetY);
        isPositioningEquation = false;
        canvas.style.cursor = 'default';
    } else if (tool === 'selection') {
        const clickedObject = getClickedObject(e.offsetX, e.offsetY);
        if (clickedObject) {
            selectedObject = clickedObject;
            offsetX = e.offsetX - selectedObject.startX;
            offsetY = e.offsetY - selectedObject.startY;
        }
    } else {
        drawing = true;
        [startX, startY] = [e.offsetX, e.offsetY];
    }
}

function draw(e) {
    if (tool === 'selection' && selectedObject) {
        const dx = e.offsetX - offsetX - selectedObject.startX;
        const dy = e.offsetY - offsetY - selectedObject.startY;
        selectedObject.startX += dx;
        selectedObject.startY += dy;
        selectedObject.endX += dx;
        selectedObject.endY += dy;
        redrawCanvas();
    } else if (drawing) {
        const action = {
            tool,
            color: tool === 'eraser' ? 'rgba(0,0,0,1)' : color,
            size,
            startX,
            startY,
            endX: e.offsetX,
            endY: e.offsetY
        };
        drawingActions.push(action);
        drawAction(action);
        [startX, startY] = [e.offsetX, e.offsetY];
    }
}

function stopDrawing() {
    drawing = false;
    selectedObject = null;
}

function getClickedObject(x, y) {
    const tolerance = 10;
    for (let i = drawingActions.length - 1; i >= 0; i--) {
        const action = drawingActions[i];
        const distanceStart = Math.sqrt(
            Math.pow(x - action.startX, 2) + Math.pow(y - action.startY, 2)
        );
        const distanceEnd = Math.sqrt(
            Math.pow(x - action.endX, 2) + Math.pow(y - action.endY, 2)
        );
        if (distanceStart < tolerance || distanceEnd < tolerance) {
            return action;
        }
    }
    return null;
}

function updateEquationPreview() {
    const latex = mathField.latex();
    const coloredLatex = applyColorToEquation(latex, color);
    MathJax.texReset();
    MathJax.typesetClear();
    equationPreview.innerHTML = '';
    MathJax.tex2svgPromise(coloredLatex).then((node) => {
        equationPreview.appendChild(node);
        MathJax.typesetPromise([equationPreview]);
    }).catch((err) => console.log(err.message));
}

function prepareEquationInsertion() {
    const latex = mathField.latex();
    const coloredLatex = applyColorToEquation(latex, color);
    MathJax.tex2svgPromise(coloredLatex).then((node) => {
        const svg = node.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            equationToInsert = {
                img: img,
                width: img.width,
                height: img.height
            };
            URL.revokeObjectURL(url);
            isPositioningEquation = true;
            canvas.style.cursor = 'crosshair';
            equationEditor.style.display = 'none';
        };
        img.src = url;
    });
}

function insertEquationAtPosition(x, y) {
    if (equationToInsert) {
        const scaledWidth = equationToInsert.width * equationSize;
        const scaledHeight = equationToInsert.height * equationSize;
        ctx.drawImage(equationToInsert.img, x, y, scaledWidth, scaledHeight);
        drawingActions.push({
            tool: 'equation',
            img: equationToInsert.img,
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight
        });
        equationToInsert = null;
    }
}

// Event listeners
window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

document.getElementById('pencil').addEventListener('click', () => tool = 'pencil');
document.getElementById('eraser').addEventListener('click', () => tool = 'eraser');
marker.addEventListener('click', () => tool = 'marker');
document.getElementById('backgroundBtn').addEventListener('click', () => backgroundInput.click());
document.getElementById('equationBtn').addEventListener('click', () => equationEditor.style.display = 'block');
document.getElementById('insertEquation').addEventListener('click', () => {
    prepareEquationInsertion();
    insertEquationAtPosition(50, 50);
});
document.getElementById('positionEquation').addEventListener('click', prepareEquationInsertion);
document.getElementById('cancelEquation').addEventListener('click', () => {
    equationEditor.style.display = 'none';
    isPositioningEquation = false;
    canvas.style.cursor = 'default';
});

sizeSelector.addEventListener('input', () => size = sizeSelector.value);
colorPicker.addEventListener('input', () => {
    color = colorPicker.value;
    updateEquationPreview(); // Update the equation preview when color changes
});

backgroundInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target.result;
                // Comprobar el tamaño del resultado
                if (result.length > 5 * 1024 * 1024) { // 5 MB
                    throw new Error("La imagen es demasiado grande para guardar en localStorage");
                }
                backgroundImage.src = result;
                localStorage.setItem('backgroundImage', result);
                console.log("Imagen guardada con éxito en localStorage");
            } catch (error) {
                console.error("Error al guardar la imagen:", error);
                alert("No se pudo guardar la imagen. Puede ser demasiado grande o tener un formato no compatible.");
            }
        };
        reader.onerror = (error) => {
            console.error("Error al leer el archivo:", error);
            alert("Hubo un error al leer el archivo. Por favor, intenta con otra imagen.");
        };
        reader.readAsDataURL(file);
    }
});

document.querySelectorAll('.equation-button').forEach(button => {
    button.addEventListener('click', () => {
        mathField.cmd(button.dataset.latex);
        mathField.focus();
    });
});

// Inicialización
resizeCanvas();
loadBackgroundImage();

// Función para limpiar el canvas
function borrarCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingActions = []; // Limpiar el historial de acciones
}

// Asigna el evento click al botón para borrar el canvas
document.getElementById('borrarCanvas').addEventListener('click', borrarCanvas);


function applyColorToEquation(latex, color) {
    return `\\color{${color}}{${latex}}`;
}

function updateSizeDisplay() {
    const sizeSelector = document.getElementById('sizeSelector');
    const sizeDisplay = document.getElementById('sizeDisplay');
    
    // Reiniciar el valor a 5 cada vez que se carga la página
    sizeSelector.value = 5;
    
    // Actualizar el display inicialmente
    sizeDisplay.textContent = sizeSelector.value;
    
    // Actualizar el display cuando el valor cambie
    sizeSelector.addEventListener('input', function() {
        sizeDisplay.textContent = this.value;
    });

    // Actualizar la variable global 'size'
    size = 5;
}

// Llama a esta función después de que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', updateSizeDisplay);