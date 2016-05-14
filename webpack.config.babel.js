"use strict";

var path               = require('path');
var webpack            = require('webpack');
var fs                 = require('fs');

/*webpack插件*/ 
var HtmlWebpackPlugin  = require('html-webpack-plugin');
var ExtractTextPlugin  = require('extract-text-webpack-plugin');
var git                = require('git-revision');
var BannerFooterPlugin = require('banner-footer-webpack-plugin');
var clean              = require('clean-webpack-plugin');
/*tools*/ 
var _                  = require('lodash');
var hidefile           = require('hidefile');

/*命令行的参数 */ 
var yargs              = require('yargs');

/*git revision*/
var gitComment = 'no git message';
try{
  gitComment   = 'HASH   :' + git('short') + '\n' +
                 'TAG    :' + git('tag')  +  '\n' +
                 'BRACNH :' + git('branch');
} catch(e){}

/*time*/
var timeComment = 'Time: ' + new Date().toLocaleString();

/*摸一下你需要打包的文件夹或者文*/ 
/*带参数以后webpack会去node_module中寻找npm，然后找不到会报个错*/ 
// var srcfileName = yargs.argv._[0];
var srcfileName = './Src/static/js/pages';
/*不用join是为了兼容绝对路*/ 
var srcfilePath = path.resolve(__dirname, srcfileName);
/*摸到文件取得文件*/ 
var jsfiles     = fs.readdirSync(srcfilePath, 'r');


/*动态生成入*/ 
var entries     = {
  /*全局都需要的包*/ 
  vendor: [
    /*
      amazeui就是个傻叉，严苛模式下用var i = require()来接jquery，麻蛋啊，jquery是方法啊，赋不上值的啊,
      不想利用provider或者imports引用node_module中的包，
    */ 
    './Src/static/lib/jquery/2.1.4/jquery.min.js',
    './Src/static/lib/AmazeUI/2.6.0/css/amazeui.min.css',
    './Src/static/lib/AmazeUI/2.6.0/js/amazeui.min.js',
    './Src/static/less/base.less',
    // './Src/static/lib/rem.js',
  ],
  // /*日历的控件*/ 
  // calendar: [
  //   './Src/static/lib/fullcalendar/2.4.0/moment.min.js',
  //   './Src/static/lib/fullcalendar/2.4.0/fullcalendar.min.css',
  //   './Src/static/lib/fullcalendar/2.4.0/fullcalendar.min.js',
  //   './Src/static/lib/fullcalendar/2.4.0/zh-cn.js'
  // ]
};
for(var i=0;i<jsfiles.length;i++){
    entries[ jsfiles[i].replace('.js', '') ] = path.join( srcfilePath, jsfiles[i] );
}


/*插件*/ 
var plugins = [];
 /*clean*/ 
plugins.push( new clean(['Build/*'], {
    root: '',
    verbose: false, 
    dry: false
  })
);

/*
webpack.ProvidePlugin跟imports-loader好，可以导入npm中的包
*/

/*暴露在全局中  这样不太好，虽然可以在任何地方随意调用，但是会出现重复加载的情况*/ 
// plugins.push( new webpack.ProvidePlugin({
//     '$'             : "jquery",
//     'jQuery'        : "jquery",
//     'window.jQuery' : "jquery"
//   }) 
// )

/*动态生成pages的plugin*/
let viewPath = './Src/views'
var viewfiles = fs.readdirSync(viewPath, 'r');

_.forEach(viewfiles, function (viewfile) {

  var name = viewfile.replace('.ejs', '');

  plugins.push( new HtmlWebpackPlugin({
      title   : name,
      template: 'ejs-compiled!' + path.join(__dirname, viewPath, viewfile),
      filename: 'Views/' + name + '.html',
      /*代表了需要哪些块*/ 
      chunks  : ['common', 'vendor', name],
      /*自动将js, css插入 不过不会按照我想要的顺序加载*/ 
      inject  : false,
      /*是否生成hash*/ 
      hash    : true
    })
  );

});

/*打包公共的部分  这样可以防止其他包在引用同样的部分后会出现重复加载*/ 
plugins.push( new webpack.optimize.CommonsChunkPlugin(
    'common', 'js/common.js'
  ) 
)

/*css单独打包，从js文件中提取出来，动态生成与page名对应的css文件*/
plugins.push(new ExtractTextPlugin('css/[name].css'));

/*js 压缩  推到线上再压缩*/ 
plugins.push( new webpack.optimize.UglifyJsPlugin({
    compress: {
        warnings: false
    }
  }) 
);

/*版本通过BannerPlugin[头部]插件注入进去  推到线上再写进去*/
plugins.push(new BannerFooterPlugin(gitComment, timeComment, {
    entryOnly: true
  })
)

/*关于配置*/ 
module.exports = {
  entry: entries,
  output: {
  	path: './Build/',
    filename: 'js/[name].js',
    /*资源的引用路径 最好改成绝对的路径 为了window，又做了路径的处理*/  
    publicPath: '../'
  },
  /*调试*/ 
  debug: false,
  /*sourcemap*/ 
  // devtool: '#source-map',
  /*缓存*/ 
  cache: false,
  /*这些不需要打包，防止生成的min文件太大了！base on global*/ 
  externals: {
    'vue'     : 'window.vue',
    'jquery'  : 'window.$'
  },
  /*不需要解析*/
  noParse: [/amazeui\.min\.css/, /jquery\.min/, /vue-form/],
  /*loader  导入的工具*/
  module: {
    loaders: [
      /*js*/
      { 
        test: /\.js?$/, 
        loader: 'babel-loader',
        /*这边不用写了，都通过.babelrc文件注入了*/ 
        exclude: /(node_modules|bower_components)/
      }, 
      /*通过'!'号loader链式操作，也可以通过数组的形式[可能是es6模式下]*/ 
      { 
        test: /\.less$/, 
        loader: ExtractTextPlugin.extract('style-loader', 'css-loader!less-loader')
      }, 
      { 
        test: /\.css$/, 
        loader: ExtractTextPlugin.extract('style-loader', 'css-loader')
      },
      {
        test: /\.(png|jpg)$/, 
        loader: 'url-loader'
      },
      /*字体*/ 
      {
          test: /\.(woff|woff2|eot|ttf|svg)(\?.*$|$)/,
          loader: 'url-loader?limit=5000&name=font/[name].[ext]'
      }, 
      /*json*/
      {
        test: /\.json$/, 
        loader: 'json-loader'
      },
      /*把jquery暴露到global*/
      {
          test: /jquery.min.js/,
          loader: 'expose-loader?$'
      },
      /*把vue暴露到global*/
      {
          test: /vue.min.js/,
          loader: 'expose-loader?Vue'
      }
    ]
  },
  /*路径解析的辅助工具*/
  resolve: {
  	/*后缀的扩展*/
  	extensions: ['', '.js', '.vue'],
    /*这边有个想法，通过fs去摸*/ 
  	/*路径的自定义配置 最好配置一些常用的*/ 
  	alias: {
      'moment': './moment.min.js'
  	},
  	/**/ 
  	root: path.join(__dirname, 'src/')
  },
  /*功能方面的插件加载过程中依次执行*/
  plugins: plugins
};
