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
    const debuggerTracker = {
        onDidSendMessage: async function (message)
        {
            // if (message.type === "event" && message.event === "stopped" && message.body.threadId !== undefined)
            // {
            //     const session = vscode.debug.activeDebugSession;
            //     if (session === undefined)
            //     {
            //         return;
            //     }
            //     let response;
            //     response = await session.customRequest("stackTrace", { threadId: 1 })
            //     let frameId = response.stackFrames[0].id;


            //     response = await session.customRequest("evaluate",
            //         {
            //             expression: `cv2.imwrite("${context.extensionPath}/output.png", variable)`,
            //             frameId: frameId
            //         }
            //     )

            //     let panel = vscode.window.createWebviewPanel(
            //         "panel",
            //         "Image View",
            //         vscode.ViewColumn.Beside
            //     );

            //     let pathToHtml = vscode.Uri.file(
            //         path.join(context.extensionPath, "webview", "index.html")
            //     );
            //     let pathUri = pathToHtml.with({ scheme: "vscode-resource" });
            //     let html = fs.readFileSync(pathUri.fsPath, "utf8");
            //     html = html.replaceAll("{{extensionPath}}", panel.webview.asWebviewUri(context.extensionUri));
            //     panel.webview.html = html;
            // }
        }
    };

    const viewTreeProvider = new impl.ViewTreeProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "views",
            viewTreeProvider
        )
    );

    const stackFrameProvider = new impl.StackFrameTreeProvider();
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
}

function deactivate() { }