const vscode = require("vscode");

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

function activate(context)
{
    const watchTreeProvider = new WatchTreeProvider();

    const debuggerTracker = {
        onWillStartSession: function() {
        },

        onWillStopSession: function() {            
        },

        onWillReceiveMessage: async function(message) {
        // if (msg.type === "request" && msg.command === "scopes") {
        //   return debugVariablesTrackerService().onScopesRequest(msg);
        // } else if (msg.type === "request" && msg.command === "variables") {
        //   return debugVariablesTrackerService().onVariablesRequest(msg);
        // } else if (msg.type === "request" && msg.command === "evaluate" && /^\s*$/.test(msg.arguments.expression)) {
        //   // this is our call, in "update-frame-id" command.
        //   return debugVariablesTrackerService().setFrameId(msg.arguments.frameId);
        // }
            // if (message.type === "request" && message.command === "evaluate")
            // {
            //     console.log(message);
            // }
        },

        onDidSendMessage: async function(message) {
            if (message.type === "event" && message.event === "stopped" && message.body.threadId !== undefined)
            {
                const session = vscode.debug.activeDebugSession;
                if (session === undefined)
                {
                    return;
                }
                let response;
                response = await session.customRequest('stackTrace', { threadId: 1 })
                let frameId = response.stackFrames[0].id;
                response = await session.customRequest("evaluate",
                    {
                        expression: "variable",
                        frameId: frameId
                    }
                )
                console.log(response);

                response = await session.customRequest(
                    "variables",
                    {
                        variablesReference: response.variablesReference,
                        filter: "indexed"
                    }
                );
                console.log(response);
            }
        }
    };

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "watch",
            watchTreeProvider
        )
    );

    vscode.debug.registerDebugAdapterTrackerFactory("python", { createDebugAdapterTracker: () => debuggerTracker });

    context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
            "python",
            {
                provideCodeActions: function()
                {
                    if (vscode.debug.activeDebugSession === undefined)
                    {
                        return [];
                    }

                    return [
                        {
                            command: "computervision.helloWorld",
                            title: "View image",
                            arguments: ["image"],
                        }
                    ];
                }
            },
            {
			    providedCodeActionKinds: [vscode.CodeActionKind.Empty]
		    }
        )
	);

    context.subscriptions.push(
		vscode.commands.registerCommand("computervision.helloWorld", 
            async function(editor, _, pythonCode)
            {
                
            }
        )
	);
}

function deactivate() { }