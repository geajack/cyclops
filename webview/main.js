class App
{
    constructor(renderer)
    {
        this.started = false;
        this.renderer = renderer;
        this.annotations = {};
    }

    start(image)
    {
        this.image = image;
        this.started = true;
        this.mouseX = 0;
        this.mouseY = 0;
        this.render({ type: "start" });
    }

    setAnnotation(id, annotation)
    {
        this.annotations[id] = annotation;
    }

    render(event)
    {
        if (!this.started) {
            return;
        }

        let width  = this.renderer.canvas.clientWidth;
        let height = this.renderer.canvas.clientHeight;

        switch (event.type)
        {
            case "resize":
            case "start":
                this.renderer.canvas.width = width;
                this.renderer.canvas.height = height;
            break;

            case "mousemove":
                if (!contextMenu.isOpen())
                {
                    this.mouseX = event.event.offsetX;
                    this.mouseY = event.event.offsetY;
                }
            break;
        }

        let gutterSize = 40;
        let availableWidth = width - 2 * gutterSize;
        let availableHeight = height - 2 * gutterSize;

        let xScale = availableWidth / this.image.width;
        let yScale = availableHeight / this.image.height;
        let scale = Math.min(xScale, yScale);
        if (scale > 1)
        {
            scale = 1;
        }

        let imageW = scale * this.image.width;
        let imageH = scale * this.image.height;
        let imageX = gutterSize + Math.floor((availableWidth - imageW) / 2);
        let imageY = gutterSize + Math.floor((availableHeight - imageH) / 2);

        this.renderer.clearRect(0, 0, width, height);

        this.renderer.drawImage(
            this.image,
            imageX,
            imageY,
            imageW,
            imageH
        );

        for (let annotation of Object.values(this.annotations))
        {
            annotation.render(this.renderer, imageX, imageY, scale);
        }

        this.mouseX = Math.floor(this.mouseX) + 0.5;
        this.mouseY = Math.floor(this.mouseY) + 0.5;

        let trueMouseX = Math.floor((this.mouseX - imageX) / scale);
        let trueMouseY = Math.floor((this.mouseY - imageY) / scale);

        let inImage = (this.mouseX <= imageX + imageW) && (this.mouseX >= imageX) && (this.mouseY <= imageY + imageH) && (this.mouseY >= imageY);
        if (inImage)
        {
            this.renderer.globalAlpha = 1;

            this.renderer.lineWidth = 1;

            this.renderer.beginPath();
            this.renderer.setLineDash([5, 5]);
            this.renderer.lineDashOffset = 0;
            this.renderer.strokeStyle = "rgba(0, 0, 0, 1)";
            this.renderer.moveTo(this.mouseX, this.mouseY);
            this.renderer.lineTo(this.mouseX, imageY);
            this.renderer.moveTo(this.mouseX, this.mouseY);
            this.renderer.lineTo(imageX, this.mouseY);
            this.renderer.stroke();
            
            this.renderer.beginPath();
            this.renderer.lineDashOffset = 5;
            this.renderer.strokeStyle = "white";
            this.renderer.moveTo(this.mouseX, this.mouseY);
            this.renderer.lineTo(this.mouseX, imageY);
            this.renderer.moveTo(this.mouseX, this.mouseY);
            this.renderer.lineTo(imageX, this.mouseY);
            this.renderer.stroke();

            this.renderer.setLineDash([]);

            this.renderer.font = "14px sans-serif";
            let boxH = 18;
            let boxW = 35;
            this.renderer.fillStyle = "black";
            this.renderer.fillRect(imageX - boxW - 0.5, this.mouseY, boxW, boxH);
            this.renderer.fillRect(this.mouseX, imageY - boxH, boxW, boxH);
            
            {
                let text = trueMouseY.toString();
                let metrics = this.renderer.measureText(text);
                let textWidth = metrics.width;
                let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                this.renderer.fillStyle = "white";
                this.renderer.fillText(text, imageX - textWidth - 3, this.mouseY + (boxH - textHeight) / 2 + textHeight);
            }

            {
                let text = trueMouseX.toString();
                let metrics = this.renderer.measureText(text);
                let textWidth = metrics.width;
                let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                this.renderer.fillStyle = "white";
                this.renderer.fillText(text, this.mouseX + 2, imageY + (boxH - textHeight) / 2 - textHeight + 3);
            }

            if (event.type === "contextmenu")
            {
                event.event.preventDefault();
                contextMenu.destroy();
                contextMenu.spawn(
                    event.event.pageX,
                    event.event.pageY,
                    [
                        {
                            label: "Copy (x, y)",
                            action: () => navigator.clipboard.writeText(
                                `${trueMouseX}, ${trueMouseY}`
                            )
                        }
                    ]
                );
            }
        }
    }
}

class ContextMenu
{
    constructor()
    {
        this.menuElement = null;
        document.body.addEventListener("click", this.destroy.bind(this));
    }

    isOpen()
    {
        return this.menuElement !== null;
    }

    destroy()
    {
        if (this.menuElement)
        {
            document.body.removeChild(this.menuElement);
            this.menuElement = null;
        }
    }

    spawn(x, y, menu)
    {
        this.menuElement = document.createElement("div");
        this.menuElement.className = "contextMenu";
        for (let item of menu)
        {
            let itemElement = document.createElement("div");
            itemElement.className = "menuItem";
            itemElement.innerText = item.label;
            this.menuElement.appendChild(itemElement);
        
            itemElement.addEventListener(
                "click",
                () =>
                {
                    item.action();                    
                }
            )
        }
        
        this.menuElement.style.left = x + "px";
        this.menuElement.style.top = y + "px";
        
        document.body.appendChild(this.menuElement);
    }
}

async function onMessage(event)
{
    const message = event.data;

    if (message.type === "image")
    {
        let imageUri = message.image;
        let image = new Image();
        image.src = imageUri;
        image.addEventListener("load", () => app.start(image));
    }
    else if (message.type === "annotation")
    {
        class PointAnnotation
        {
            constructor(parameters)
            {
                let { x, y } = parameters;
                this.x = x;
                this.y = y;
            }

            render(context, x0, y0, scaling)
            {
                let x = x0 + this.x * scaling;
                let y = y0 + this.y * scaling;

                context.beginPath();
                context.setLineDash([]);
                context.strokeStyle = "red";
                context.moveTo(x - 5, y);
                context.lineTo(x + 5, y);
                context.moveTo(x, y - 5);
                context.lineTo(x, y + 5);
                context.stroke();
            }
        }

        let annotation = new PointAnnotation(message.annotation);
        app.setAnnotation(message.annotation.id, annotation);
        app.render(EVENT_NONE);
    }
}

const EVENT_NONE = { type: "none" };

let canvas = document.querySelector("canvas");

window.addEventListener("message", onMessage);

let contextMenu = new ContextMenu();

const app = new App(canvas.getContext("2d"));

let resizeObserver = new ResizeObserver(() => app.render({ type: "resize" }));
resizeObserver.observe(canvas, { box: "border-box"});

canvas.addEventListener("mousemove", event => app.render({ type: "mousemove", event: event }));
canvas.addEventListener("contextmenu", event => app.render({ type: "contextmenu", event: event }));