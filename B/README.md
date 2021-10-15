# 图片压缩CLI

## 一、安装
```bash
$ sudo npm i xxx -g --registry=xxx -dd --unsafe-perm=true --allow-root
```

### 1.1 安装失败了？
[因为npm安装时pngquant-bin时大概率会失败。。如果失败了可以看下面，详情可以点这个链接](https://github.com/imagemin/imagemin-pngquant/issues/46)

### 1.2 Mac
mac需要`libpng`
```bash
$  brew install libpng
$  brew install pngquant
```

### 1.3 Linux/CentOS/Ubuntu
需要安装`libpng-dev`库 -- [Updating pre-compiled binaries](https://github.com/imagemin/pngquant-bin#updating-pre-compiled-binaries)

### 1.4 Homebrew安装失败？
如果brew安装失败，可以试试换个镜像 --- [Homebrew](http://wiki.intra.xiaojukeji.com/display/~tobyzhang/Homebrew)


## 二、使用
```bash
# 压缩图片
$ Mim ./path/to/file.png

# 压缩一个文件夹下的所有图片
$ Mim ./path/to/images/
```

## 三、支持压缩的图片类型
- png
- svg <sup>Deving</sup>
- gif <sup>Deving</sup>
- jpeg <sup>Deving</sup>
