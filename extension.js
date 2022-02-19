const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

module.exports = {
    activate,
    deactivate,
};

class WatchTreeProvider
{
    getTreeItem(element)
    {
        return element;
    }

    async getChildren(element)
    {
        if (!element)
        {
            let item = {};
            item.label = "Hello, world!";
            return [item];
        }
        else
        {
            return [];
        }
    }
}

let currentImageID = 0;
function getImageName()
{
    let name = currentImageID.toString();
    currentImageID++;
    return name;
}

const VIEW_IMAGE_COMMAND_ID = "viewImage";

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

    // const watchTreeProvider = new WatchTreeProvider();
    // context.subscriptions.push(
    //     vscode.window.registerTreeDataProvider(
    //         "watch",
    //         watchTreeProvider
    //     )
    // );

    vscode.debug.registerDebugAdapterTrackerFactory("python", { createDebugAdapterTracker: () => debuggerTracker });

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "python",
            {
                provideCodeActions: function(document, selectionRange)
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
                                command: VIEW_IMAGE_COMMAND_ID,
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
            },
            {
                providedCodeActionKinds: [vscode.CodeActionKind.Empty]
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(VIEW_IMAGE_COMMAND_ID,
            async function (pythonCode)
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

                response = await session.customRequest("evaluate",
                    {
                        expression: `cv2.imwrite("${context.extensionPath}/${outputFileName}", (${pythonCode}))`,
                        frameId: frameId
                    }
                )

                let fileWasCreated = fs.existsSync(path.join(context.extensionPath, outputFileName));
                if (fileWasCreated)
                {
                    let panel = vscode.window.createWebviewPanel(
                        "panel",
                        "Image View",
                        vscode.ViewColumn.Beside
                    );
    
                    let pathToHtml = vscode.Uri.file(
                        path.join(context.extensionPath, "webview", "index.html")
                    );
                    let pathUri = pathToHtml.with({ scheme: "vscode-resource" });
                    let html = fs.readFileSync(pathUri.fsPath, "utf8");
                    html = html.replaceAll("{{extensionPath}}", panel.webview.asWebviewUri(context.extensionUri));
                    html = html.replaceAll("{{imageFileName}}", outputFileName);
                    panel.webview.html = html;
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