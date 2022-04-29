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
    constructor(storageURI, extensionURI)
    {
        this.storageURI = storageURI;
        this.extensionURI = extensionURI;
    }

    async view(pythonCode, stackFrameID)
    {
        const storageURI = this.storageURI;
        const extensionURI = this.extensionURI;

        const session = vscode.debug.activeDebugSession;
        if (session === undefined)
        {
            return;
        }
        let response;
        response = await session.customRequest("stackTrace", { threadId: 1 })

        let outputFileName = getImageName() + ".png";
        let outputFilePath = path.join(storageURI.fsPath, outputFileName);

        response = await session.customRequest("evaluate",
            {
                expression: `cv2.imwrite(r"${outputFilePath}", (${pythonCode}))`,
                frameId: stackFrameID
            }
        );

        let fileWasCreated = fs.existsSync(path.join(storageURI.fsPath, outputFileName));
        if (fileWasCreated)
        {
            let panel = vscode.window.createWebviewPanel(
                "panel",
                pythonCode,
                vscode.ViewColumn.Beside,
                {
                    localResourceRoots: [storageURI, vscode.Uri.file(path.join(extensionURI.fsPath, "webview"))],
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            let htmlPath = path.join(extensionURI.fsPath, "webview", "index.html");
            let html = fs.readFileSync(htmlPath, "utf8");
            html = html.replaceAll("{{extensionPath}}", panel.webview.asWebviewUri(extensionURI));
            html = html.replaceAll("{{storagePath}}", panel.webview.asWebviewUri(storageURI));
            panel.webview.html = html;

            let imageUri = panel.webview.asWebviewUri(
                vscode.Uri.file(
                    path.join(storageURI.fsPath, outputFileName)
                )
            );
            panel.webview.postMessage({ image: imageUri.toString() });

            return panel;
        }
        else
        {
            return null;            
        }
    }
}

class ExpressionManager
{
    constructor()
    {
        this.expressions = [];
        this.currentViewID = 0;
    }

    addView(expression)
    {
        this.expressions.push(
            {
                label: expression,
                expression: expression,
                id: this.currentViewID
            }
        );
        this.currentViewID++;
    }

    setPanelForView(panel, viewID)
    {
    }

    unsetPanelForView(viewID)
    {
    }    

    getExpressions()
    {
        return this.expressions;
    }
}

class ExpressionTreeProvider
{
    constructor(expressionManager)
    {
        this.expressionManager = expressionManager;
        this.onDidChangeTreeDataEventEmitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
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
            for (let info of this.expressionManager.getExpressions())
            {
                let item = {};
                item.label = info.label;
                item.id = info.id;
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

class StackFrameTreeProvider
{
    constructor(imageViewer)
    {
        this.onDidChangeTreeDataEventEmitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
        this.frames = null;
        this.imageViewer = imageViewer;
    }

    getTreeItem(element)
    {
        return element;
    }

    setStack(frames)
    {
        this.frames = frames;
        this.onDidChangeTreeDataEventEmitter.fire();
    }

    async getChildren(element)
    {
        if (element)
        {
            return [];
        }
        
        if (this.frames !== null)
        {
            return this.frames.map(
                frame => {
                    return {
                        label: frame.name,
                        id: frame.id,
                        description: frame.id === this.stackFrameID ? "active" : ""
                    }
                }
            )
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
    ExpressionTreeProvider,
    StackFrameTreeProvider,
    ExpressionManager,
    provideCodeActions
};