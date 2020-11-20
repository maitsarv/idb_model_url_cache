const path = require('path');

const config = {
    entry: {
        'IndexedDBModelCache' : path.join(__dirname, './src/idbrequesthandler.js'),
        'SubtlecryptoHelper' : path.join(__dirname, './src/plugins/subtlecryptohelper.js')
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
        library: '[name]',
        libraryExport: "default"
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                        // presets: ['es2015']
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js']
    },
    devServer:{
        port: 3000,
        contentBase: __dirname + '/build',
        inline: true
    }
}
module.exports = config;