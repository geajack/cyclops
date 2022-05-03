const vscode = require("vscode");
const impl = require("./implementation.js")
const constants = require("./constants.js")
const annotationTypes = require("./annotations.js")
const path = require("path");
const fs = require("fs")

module.exports = {
    activate,
    deactivate,
};

function activate(context)
{
    let stackFrameID = null;

    const expressionManager = new impl.ExpressionManager();
    const expressionTreeProvider = new impl.ExpressionTreeProvider(expressionManager);
    const expressionTree = vscode.window.createTreeView(
        "expressions",
        { treeDataProvider: expressionTreeProvider }
    );
    expressionTree.onDidChangeSelection(
        async function(event)
        {
            if (event.selection.length > 0)
            {
                let item = event.selection[0];
                if (item.contextValue === "parameter")
                {
                    let { expressionID, annotationID, name } = item;

                    let value = await vscode.window.showInputBox(
                        {
                            prompt: "Enter value for " + item.label
                        }
                    );

                    if (value !== undefined)
                    {
                        expressionManager.setParameter(expressionID, annotationID, name, value);
                        expressionTreeProvider.onDidChangeTreeDataEventEmitter.fire();

                        renderAnnotation(expressionID, annotationID);
                    }
                }
            }
        }
    );
        
    const imageViewer = new impl.ImageViewer(context.storageUri, context.extensionUri);
            
    const stackFrameProvider = new impl.StackFrameTreeProvider(imageViewer);

    const debuggerTracker = {
        onDidSendMessage: async function (message)
        {
            if (message.type === "event")
            {
                if (message.event === "stopped" && message.body.threadId !== undefined)
                {
                    const session = vscode.debug.activeDebugSession;
                    if (session === undefined)
                    {
                        return;
                    }
                    let frames = await session.customRequest("stackTrace", { threadId: 1 });
                    let topFrame = frames.stackFrames[0];
                    stackFrameID = topFrame.id;
                    stackFrameProvider.stackFrameID = topFrame.id;
                    stackFrameProvider.setStack(frames.stackFrames);

                    for (let expression of expressionManager.getExpressions())
                    {
                        let expressionID = expression.id;
                        for (let annotationID of Object.keys(expression.annotations))
                        {
                            renderAnnotation(expressionID, annotationID);
                        }
                    }
                }
                else if (message.event === "terminated")
                {
                    stackFrameID = null;
                    stackFrameProvider.stackFrameID = null;
                    stackFrameProvider.setStack([]);
                }
            }
        }
    };

    let stackFrameTree = vscode.window.createTreeView(
        "stackFrames",
        { treeDataProvider: stackFrameProvider }
    );
    stackFrameTree.onDidChangeSelection(event => {
        if (event.selection.length > 0)
        {
            let frameID = event.selection[0].id;
            stackFrameID = frameID;
            stackFrameProvider.stackFrameID = frameID;
            stackFrameProvider.onDidChangeTreeDataEventEmitter.fire();
        }
    });

    let storagePath = context.storageUri.fsPath;
    fs.mkdirSync(storagePath, { recursive: true });

    for (let fileName of fs.readdirSync(storagePath))
    {
        fs.rmSync(
            path.join(storagePath, fileName)
        );
    }

    vscode.debug.registerDebugAdapterTrackerFactory("python", { createDebugAdapterTracker: () => debuggerTracker });

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "python",
            {
                provideCodeActions: impl.provideCodeActions
            },
            {
                providedCodeActionKinds: [vscode.CodeActionKind.Empty]
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            constants.VIEW_IMAGE_COMMAND_ID,
            function(pythonCode)
            {
                let expressionID = expressionManager.addExpression(pythonCode);
                openView(pythonCode, expressionID);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "computerVision.removeExpression",
            async function(expressionInfo)
            {
                let response = await vscode.window.showInformationMessage("Are you sure you want to remove this expression?", "Yes", "No");

                if (response === "Yes")
                {
                    let { id } = expressionInfo;
                    expressionManager.removeExpression(id);
                    expressionTreeProvider.onDidChangeTreeDataEventEmitter.fire();
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "computerVision.openView",
            async function(expressionInfo)
            {
                let expressionID = expressionInfo.id;
                let expression = expressionManager.getExpression(expressionID);
                let pythonCode = expression.expression;

                let panel = expressionManager.getPanelForView(expressionID);
                if (panel === null)
                {
                    await openView(pythonCode, expressionID);

                    for (let annotation of Object.values(expression.annotations))
                    {
                        renderAnnotation(expressionID, annotation.id);
                    }
                }
                else
                {
                    panel.reveal();
                }
            }
        )
    );

    for (let annotationType of annotationTypes.annotationTypes)
    {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                annotationType.command,
                async function(item)
                {
                    expressionManager.addAnnotation(item.id, annotationType);
                    expressionTreeProvider.onDidChangeTreeDataEventEmitter.fire();
                }
            )
        );
    }

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "computerVision.addExpression",
            async function()
            {
                let pythonCode = await vscode.window.showInputBox(
                    {
                        prompt: "Add expression:"
                    }
                );
                expressionManager.addExpression(pythonCode);
                expressionTreeProvider.onDidChangeTreeDataEventEmitter.fire();
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "computerVision.removeAnnotation",
            async function(item)
            {
                expressionManager.removeAnnotation(item.expressionID, item.id);
                expressionTreeProvider.onDidChangeTreeDataEventEmitter.fire();

                let expression = expressionManager.getExpression(item.expressionID);
                if (expression.panel)
                {
                    let message = {
                        type: "removeAnnotation",
                        id: item.id
                    };
                    expression.panel.webview.postMessage(message);
                }
            }
        )
    );

    async function renderAnnotation(expressionID, annotationID)
    {
        let expression = expressionManager.getExpression(expressionID);
        if (expression.panel)
        {
            let annotation = expression.annotations[annotationID];
            let parameters = Object.values(annotation.parameters);

            let isReady = parameters.every(p => p.expression !== null);

            let message = {
                type: "annotation",
                annotation: {
                    id: annotation.id,
                    type: annotation.type
                }
            };

            if (isReady)
            {
                for (let parameter of parameters)
                {
                    const session = vscode.debug.activeDebugSession;
                    let response = await session.customRequest("evaluate",
                        {
                            expression: parameter.expression,
                            frameId: stackFrameID
                        }
                    );

                    if (response.type == "int" || response.type == "float")
                    {
                        message.annotation[parameter.name] = Number.parseFloat(response.result);
                    }
                }

                expression.panel.webview.postMessage(message);
            }
        }
    }

    async function openView(pythonCode, expressionID)
    {        
        expressionTreeProvider.onDidChangeTreeDataEventEmitter.fire();

        let panel = await imageViewer.view(pythonCode, stackFrameID);
        if (panel !== null)
        {
            expressionManager.setPanelForView(panel, expressionID);

            panel.onDidDispose(
                () => {
                    expressionManager.unsetPanelForView(expressionID);
                },
                null,
                context.subscriptions
            );
        }
        else
        {
            vscode.window.showErrorMessage("Expression could not be saved as image!");
        }
    }
}

function deactivate() { }