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
    constructor(context, viewTreeProvider)
    {
        this.context = context;
        this.viewTreeProvider = viewTreeProvider;
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
                pythonCode,
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
            panel.webview.html = html;

            let imageUri = panel.webview.asWebviewUri(
                vscode.Uri.file(
                    path.join(this.context.storageUri.fsPath, outputFileName)
                )
            );
            panel.webview.postMessage({ image: imageUri.toString() });

            this.viewTreeProvider.addView(panel, pythonCode, this.context);
        }
        else
        {
            vscode.window.showErrorMessage("Expression could not be saved as image!");
        }
    }
}

class ViewTreeProvider
{
    constructor()
    {
        this.openPanels = [];

        this.onDidChangeTreeDataEventEmitter = new vscode.EventEmitter();

        this.onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
    }

    addView(panel, expression, context)
    {
        panel.onDidDispose(
            () => {
                this.openPanels = this.openPanels.filter(info => info.panel !== panel);
                this.onDidChangeTreeDataEventEmitter.fire();
            },
            null,
            context.subscriptions
        );
        this.openPanels.push(
            {
                panel: panel,
                expression: expression
            }
        );
        this.onDidChangeTreeDataEventEmitter.fire();
    }

    getTreeItem(element)
    {
        return element;
    }

    async getChildren(element)
    {
        if (!element)
        {
            let items = [];
            for (let info of this.openPanels)
            {
                let item = {};
                item.label = info.expression;             
                items.push(item)
            }
            return items;
        }
        else
        {
            return [];
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
    ViewTreeProvider,
    provideCodeActions
};