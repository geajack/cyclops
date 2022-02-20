(function()
{
    
    let img = document.getElementById("image");
    
    let ants = document.getElementById("marchingAnts");
    img.addEventListener("mousemove", onMouseMove);
    ants.addEventListener("mousemove", onMouseMove);
    
    let xLabel = document.getElementById("xLabel");
    let yLabel = document.getElementById("yLabel");
    
    window.addEventListener("message", onMessage);

    async function onMessage(event)
    {
        let imageUri = event.data.image;
        console.log(imageUri);

        img.src = imageUri;
    }

    function onMouseMove(event)
    {
        ants.style.left = (img.offsetLeft + 1) + "px";
        ants.style.top = (img.offsetTop + 1) + "px";
        ants.style.width = (event.offsetX) + "px";
        ants.style.height = (event.offsetY) + "px";
        
        let width = xLabel.offsetWidth;
        let height = xLabel.offsetHeight;
        xLabel.style.left = (img.offsetLeft + event.offsetX + 1) + "px";
        xLabel.style.top = (img.offsetTop - height) + "px";
        yLabel.style.left = (img.offsetLeft - width) + "px";
        yLabel.style.top = (img.offsetTop + event.offsetY + 1) + "px";

        xLabel.innerText = parseInt(img.naturalWidth * event.offsetX / img.width);
        yLabel.innerText = parseInt(img.naturalHeight * event.offsetY / img.height);
    }
})();