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
    
    const viewTreeProvider = new impl.ViewTreeProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "views",
            viewTreeProvider
        )
    );
        
    const imageViewer = new impl.ImageViewer(context, viewTreeProvider);
            
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
                    imageViewer.setStackFrame(topFrame.id);
                    stackFrameProvider.setStack(frames.stackFrames);
                }
                else if (message.event === "terminated")
                {
                    imageViewer.onDebuggingStopped();
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
            imageViewer.setStackFrame(frameID);
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
        vscode.commands.registerCommand(constants.VIEW_IMAGE_COMMAND_ID, pythonCode => imageViewer.view(pythonCode))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            constants.CLOSE_VIEW_COMMAND_ID,
            viewTreeProvider.onUserRequestedClosePanel.bind(viewTreeProvider)
        )
    );
}

function deactivate() { }