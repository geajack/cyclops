const vscode = require("vscode");

module.exports = {
    activate,
    deactivate,
};

let watchTreeProvider;

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
    watchTreeProvider = new WatchTreeProvider();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "watch",
            watchTreeProvider
        )
    );
}

function deactivate() { }