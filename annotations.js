const annotationTypes = [
    {
        label: "Point",
        name: "point",
        command: "computerVision.addPoint",
        parameters: [
            {
                label: "x",
                name: "x"
            },
            {
                label: "y",
                name: "y"
            }
        ]
    },
    {
        label: "Rectangle",
        name: "rectangle",
        command: "computerVision.addRectangle",
        parameters: [
            {
                label: "x1",
                name: "x1"
            },
            {
                label: "y1",
                name: "y1"
            },
            {
                label: "x2",
                name: "x2"
            },
            {
                label: "y2",
                name: "y2"
            }
        ]
    }
];

module.exports = {
    annotationTypes
};