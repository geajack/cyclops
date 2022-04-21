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
    const stackFrameProvider = new impl.StackFrameTreeProvider();

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
                    let frames = await session.customRequest("stackTrace", { threadId: 1 })
                    stackFrameProvider.setStack(frames);
                }
                else if (message.event === "terminated")
                {
                    stackFrameProvider.setStack([]);
                    imageViewer.onDebuggingEnded();
                }
            }
        }
    };

    const viewTreeProvider = new impl.ViewTreeProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "views",
            viewTreeProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "stackFrames",
            stackFrameProvider
        )
    );

    let storagePath = context.storageUri.fsPath;
    fs.mkdirSync(storagePath, { recursive: true });

    for (let fileName of fs.readdirSync(storagePath))
    {
        fs.rmSync(
            path.join(storagePath, fileName)
        );
    }

    const imageViewer = new impl.ImageViewer(context, viewTreeProvider);

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

    context.subscriptions.push(
        vscode.commands.registerCommand(
            constants.SWITCH_STACK_FRAME_COMMAND_ID,
            frameInfo => imageViewer.setStackFrame(frameInfo.id)
        )
    );
}

function deactivate() { }