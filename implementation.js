const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const constants = require("./constants.js")

let currentImageID = 0;
function getImageName()
{
    let name = currentImageID.toString();
    currentImageID++;
    return name;
}

class ImageViewer
{
    constructor(context)
    {
        this.context = context;
    }

    async view(pythonCode)
    {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined)
        {
            return;
        }
        let response;
        response = await session.customRequest("stackTrace", { threadId: 1 })
        let frameId = response.stackFrames[0].id;

        let outputFileName = getImageName() + ".png";
        let outputFilePath = path.join(this.context.storageUri.fsPath, outputFileName)

        response = await session.customRequest("evaluate",
            {
                expression: `cv2.imwrite(r"${outputFilePath}", (${pythonCode}))`,
                frameId: frameId
            }
        )

        let fileWasCreated = fs.existsSync(path.join(this.context.storageUri.fsPath, outputFileName));
        if (fileWasCreated)
        {
            let panel = vscode.window.createWebviewPanel(
                "panel",
                "Image View",
                vscode.ViewColumn.Beside,
                {
                    localResourceRoots: [this.context.storageUri, vscode.Uri.file(path.join(this.context.extensionUri.fsPath, "webview"))],
                    enableScripts: true
                }
            );

            let htmlPath = path.join(this.context.extensionPath, "webview", "index.html");
            let html = fs.readFileSync(htmlPath, "utf8");
            html = html.replaceAll("{{extensionPath}}", panel.webview.asWebviewUri(this.context.extensionUri));
            html = html.replaceAll("{{storagePath}}", panel.webview.asWebviewUri(this.context.storageUri));
            // html = html.replaceAll("{{imageFileName}}", outputFileName);
            panel.webview.html = html;

            let imageUri = panel.webview.asWebviewUri(
                vscode.Uri.file(
                    path.join(this.context.storageUri.fsPath, outputFileName)
                )
            );
            panel.webview.postMessage({ image: imageUri.toString() });
        }
        else
        {
            vscode.window.showErrorMessage("Expression could not be saved as image!");
        }
    }
}

function provideCodeActions(document, selectionRange)
{
    if (vscode.debug.activeDebugSession === undefined)
    {
        return [];
    }

    let selectedString = document.getText(selectionRange);
    if (selectedString === "") {
        // the user not selected a range. need to figure out which variable he's on
        selectedString = document.getText(
            document.getWordRangeAtPosition(selectionRange.start)
        );
    }

    if (selectedString !== "")
    {
        return [
            {
                command: constants.VIEW_IMAGE_COMMAND_ID,
                title: "View image",
                arguments: [selectedString],
            }
        ];
    }
    else
    {
        return [];
    }
}

module.exports = {
    ImageViewer,
    provideCodeActions
};