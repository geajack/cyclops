const vscode = require("vscode");
const impl = require("./implementation.js")
const constants = require("./constants.js")
const path = require("path");
const fs = require("fs")

module.exports = {
    activate,
    deactivate,
};

function activate(context)
{
    let stackFrameID = null;

    const viewManager = new impl.ViewManager();
    
    const viewTreeProvider = new impl.ViewTreeProvider(viewManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "views",
            viewTreeProvider
        )
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
            async function(pythonCode)
            {
                let viewID = viewManager.addView(pythonCode);
                viewTreeProvider.onDidChangeTreeDataEventEmitter.fire();

                let panel = await imageViewer.view(pythonCode, stackFrameID);
                if (panel !== null)
                {
                    viewManager.setPanelForView(panel, viewID);

                    panel.onDidDispose(
                        () => {
                            viewManager.unsetPanelForView(viewID);
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
        )
    );
}

function deactivate() { }