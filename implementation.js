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

        let outputFileName = getImageName() + ".png";
        let outputFilePath = path.join(storageURI.fsPath, outputFileName);

        let response = await session.customRequest("evaluate",
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
            panel.webview.postMessage({ type: "image", image: imageUri.toString() });

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
        this.expressions = {};
        this.currentID = 0;
    }

    addExpression(expression)
    {
        let expressionID = this.currentID;
        this.expressions[expressionID] = {
            label: expression,
            expression: expression,
            id: expressionID,
            panel: null,
            annotations: {}
        };
        this.currentID++;
        return expressionID;
    }

    addAnnotation(expressionID, annotationType)
    {
        let annotation = {
            label: annotationType.label,
            id: this.currentID,
            expressionID: expressionID,
            type: annotationType.name,
            parameters: {}
        };

        for (let parameter of annotationType.parameters)
        {
            annotation.parameters[parameter.name] = {
                label: parameter.label,
                name: parameter.name,
                expression: null,
                annotationID: this.currentID,
                expressionID: expressionID
            };
        }

        this.expressions[expressionID].annotations[this.currentID] = annotation;
        this.currentID++;
    }

    setParameter(expressionID, annotationID, name, value)
    {
        this.expressions[expressionID].annotations[annotationID].parameters[name].expression = value;
    }

    removeAnnotation(expressionID, annotationID)
    {
        delete this.expressions[expressionID].annotations[annotationID];
    }

    removeExpression(expressionID)
    {
        delete this.expressions[expressionID];
    }

    getPanelForView(expressionID)
    {
        return this.expressions[expressionID].panel;
    }

    setPanelForView(panel, expressionID)
    {
        this.expressions[expressionID].panel = panel;
    }

    unsetPanelForView(expressionID)
    {
        this.expressions[expressionID].panel = null;
    }

    getExpression(expressionID)
    {
        return this.expressions[expressionID];
    }

    getExpressions()
    {
        return Object.values(this.expressions);
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
            for (let expression of this.expressionManager.getExpressions())
            {
                let item = Object.create(expression);
                item.label = expression.label;
                item.id = expression.id;
                item.contextValue = "expression";

                item.children = [];
                for (let annotation of Object.values(expression.annotations))
                {
                    let childItem = Object.create(annotation);
                    childItem.label = annotation.label;
                    childItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    childItem.contextValue = "annotation";
                    childItem.children = [];

                    for (let parameter of Object.values(annotation.parameters))
                    {
                        let grandChildItem = Object.create(parameter);
                        grandChildItem.label = parameter.label;
                        grandChildItem.description = parameter.expression;
                        grandChildItem.contextValue = "parameter";
                        childItem.children.push(grandChildItem);
                    }

                    item.children.push(childItem);
                }

                if (item.children.length > 0)
                {
                    item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                }
                else
                {
                    item.collapsibleState = vscode.TreeItemCollapsibleState.None;
                }

                items.push(item);
            }
            return items;
        }
        else
        {
            return element.children || [];
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