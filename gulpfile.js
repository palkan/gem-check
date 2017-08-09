var gulp = require('gulp');
var browserSync = require("browser-sync");
var hljs = require('highlight.js');
var reload = browserSync.reload;


var md = require('markdown-it')(
  {
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(lang, str).value;
        } catch (__) {}
      }

      return ''; // use external default escaping
    },
    linkify: true,
    html: true,
    typographer: true,
  }
).use(
  require('markdown-it-container'), 'caption'
).use(require('markdown-it-checkbox'));

var options = {
  env: 'development',
};

var filters = {
  'md': function (str, options) {
    return md.render(str);
  }
};

function config(dir){
  return {
    server: {
      baseDir: ['./', dir]
    },
    host: 'localhost',
    port: 4242
  };
};

gulp.task('html', function() {
  var pug = require('gulp-pug');
  var useref = require('gulp-useref');

  return gulp.src('src/**/*.pug')
    .pipe(pug({pretty: true, locals: options, filters: filters }))
    .pipe(useref({searchPath: './'}))
    .pipe(gulp.dest('./build'))
    .pipe(reload({stream: true}));
});

gulp.task('styles', function () {
  var postcss    = require('gulp-postcss');
  var sourcemaps = require('gulp-sourcemaps');

  return gulp.src('src/styles/main.css')
    .pipe(sourcemaps.init())
    .pipe(postcss([
      require('postcss-cssnext'),
      require('precss'),
      require('postcss-easings')
    ]))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./build'))
    .pipe(reload({stream: true}));
});

gulp.task('copy:fonts', function () {
  return gulp.src('src/fonts/*')
    .pipe(gulp.dest('./build/fonts'))
    .pipe(reload({stream: true}));
});

gulp.task('copy:images', function () {
  return gulp.src('src/images/**/*')
    .pipe(gulp.dest('./build/images'))
    .pipe(reload({stream: true}));
});

gulp.task('copy:root', function () {
  return gulp.src(['src/*.{xml,png,ico,json,svg}', 'src/CNAME'])
    .pipe(gulp.dest('./build'))
    .pipe(reload({stream: true}));
});

gulp.task('copy:vendor', function () {
  return gulp.src(['src/vendor/*.{js,css}'])
    .pipe(gulp.dest('./build/vendor'))
    .pipe(reload({stream: true}));
});

gulp.task('copy',
  gulp.parallel(
    'copy:images',
    'copy:root',
    'copy:vendor',
    'copy:fonts'
  )
);

gulp.task('serve', function() {
   browserSync(config('./build'));
});

gulp.task('watch', function() {
  gulp.watch(['src/**/*.pug', 'src/**/*.md'], gulp.series('html'));
  gulp.watch('src/**/*.js', gulp.series('html'));
  gulp.watch('src/**/*.css', gulp.series('styles'));
  gulp.watch('src/images/**/*', gulp.series('copy:images', 'html'));
});

gulp.task('clean', function(){
  var del = require('del');
  return del([
    './build/**/*'
  ]);
});

gulp.task('build',
  gulp.series(
    'clean', 
    gulp.parallel(
      'styles', 'html', 'copy'
    )
  )
);

gulp.task('build:prod', 
  gulp.series(
    function(cb) { options.env = 'production'; cb(); },
    'build'
  )
);

gulp.task('default', gulp.series('build', gulp.parallel('serve', 'watch')));
