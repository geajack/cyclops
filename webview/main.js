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

        switch (event.type)
        {
            case "resize":
            case "start":
                console.log(this.renderer.canvas.clientHeight, this.renderer.canvas.height);
                let width  = this.renderer.canvas.clientWidth;
                let height = this.renderer.canvas.clientHeight;
                this.renderer.canvas.width = width;
                this.renderer.canvas.height = height;
            break;
        }

        this.renderer.drawImage(this.image, 0, 0);
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