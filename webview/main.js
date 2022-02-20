class App
{
    constructor(canvas)
    {
        this.started = false;
        this.renderer = canvas;
    }

    start(image)
    {
        this.image = image;
        this.started = true;
        this.render({ type: "start" });
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
        }

        let imageX = (width - this.image.width) / 2;
        let imageY = (height - this.image.height) / 2;

        this.renderer.clearRect(0, 0, width, height);

        this.renderer.drawImage(
            this.image,
            imageX,
            imageY
        );
    }
}

let canvas = document.querySelector("canvas").getContext("2d");

window.addEventListener("message", onMessage);

const app = new App(canvas);

let resizeObserver = new ResizeObserver(() => app.render({ type: "resize" }));
resizeObserver.observe(canvas.canvas, { box: "border-box"});

async function onMessage(event)
{
    let imageUri = event.data.image;

    let image = new Image();
    image.src = imageUri;
    image.addEventListener("load", () => app.start(image));
}