class App
{
    constructor(renderer)
    {
        this.started = false;
        this.renderer = renderer;
    }

    start(image)
    {
        this.image = image;
        this.started = true;
        this.mouseX = 0;
        this.mouseY = 0;
        this.render({ type: "start" });
    }

    render(event)
    {
        if (!this.started) {
            return;
        }

        let width  = this.renderer.canvas.clientWidth;
        let height = this.renderer.canvas.clientHeight;

        let displayContextMenu = false;

        switch (event.type)
        {
            case "resize":
            case "start":
                this.renderer.canvas.width = width;
                this.renderer.canvas.height = height;
            break;

            case "mousemove":
                this.mouseX = event.event.offsetX;
                this.mouseY = event.event.offsetY;
            break;
        }

        let imageW = this.image.width;
        let imageH = this.image.height;
        let imageX = Math.floor((width - this.image.width) / 2);
        let imageY = Math.floor((height - this.image.height) / 2);

        this.renderer.clearRect(0, 0, width, height);

        this.renderer.drawImage(
            this.image,
            imageX,
            imageY
        );

        this.mouseX += 0.5;
        this.mouseY += 0.5;

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
                let text = Math.floor(this.mouseY - imageY).toString();
                let metrics = this.renderer.measureText(text);
                let textWidth = metrics.width;
                let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                this.renderer.fillStyle = "white";
                this.renderer.fillText(text, imageX - textWidth - 3, this.mouseY + (boxH - textHeight) / 2 + textHeight);
            }

            {
                let text = Math.floor(this.mouseX - imageX).toString();
                let metrics = this.renderer.measureText(text);
                let textWidth = metrics.width;
                let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                this.renderer.fillStyle = "white";
                this.renderer.fillText(text, this.mouseX + 2, imageY + (boxH - textHeight) / 2 - textHeight + 3);
            }

            if (event.type === "contextmenu")
            {
                event.event.preventDefault();
                contextMenu(
                    event.event.pageX,
                    event.event.pageY,
                    [
                        {
                            label: "Copy (x, y)",
                            action: () => navigator.clipboard.writeText(
                                `${Math.floor(this.mouseX - imageX)}, ${Math.floor(this.mouseY - imageY)}`
                            )
                        }
                    ]
                );
            }
        }
    }
}

function contextMenu(x, y, menu)
{
    let menuElement = document.createElement("div");
    menuElement.className = "contextMenu";
    for (let item of menu)
    {
        let itemElement = document.createElement("div");
        itemElement.className = "menuItem";
        itemElement.innerText = item.label;
        menuElement.appendChild(itemElement);

        itemElement.addEventListener(
            "click",
            () =>
            {
                document.body.removeChild(menuElement);
                item.action();
            }
        )
    }

    menuElement.style.left = x + "px";
    menuElement.style.top = y + "px";

    document.body.appendChild(menuElement);
}

let canvas = document.querySelector("canvas");

window.addEventListener("message", onMessage);

const app = new App(canvas.getContext("2d"));

let resizeObserver = new ResizeObserver(() => app.render({ type: "resize" }));
resizeObserver.observe(canvas, { box: "border-box"});

canvas.addEventListener("mousemove", event => app.render({ type: "mousemove", event: event }));

canvas.addEventListener("contextmenu", event => app.render({ type: "contextmenu", event: event }));

async function onMessage(event)
{
    let imageUri = event.data.image;

    let image = new Image();
    image.src = imageUri;
    image.addEventListener("load", () => app.start(image));
}