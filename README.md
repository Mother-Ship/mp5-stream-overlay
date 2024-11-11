## MP5专用直播自定义Overlay

这套自定义界面包含了4个场景需要的浏览器Overlay：

- BAN_PICK，用于展示双方选图
- SHOWCASE_INFO，用于Showcase时展示谱面信息
- PLAYING，用于正式比赛时展示信息
- SHOWCASE_PLAYING，用于Showcase播放Replay时展示信息

以及一个广告轮播场景需要的静态资源：

- WAITING_POSTER （该场景需要用到的资源在OBS Assets目录下）

这套界面由foraphe和我从MP5 Mystic Arena II的开赛前 迭代开发至今，非常感谢foraphe的大力支持，他在歌曲数据计算和离线图兼容上做了大量的工作，也几乎一力撑起了S21期间的需求。

MP5 S21是一场3V3比赛，除了瑞士轮+双败淘汰赛制外，还加入了歌曲竞猜机制（Showcase前可能有部分谱面离线），因此这套界面也提供了对应的功能、兼容性改造等。

如果你是其他MeowDevice赞助比赛的工作人员，可以遵循下方的指引，轻松的将这套界面移植到你自己的比赛。

## 使用方法

---

### 操作步骤

如果你是直播员，你应该会在MP5的Staff/直播群/本仓库的Action找到包含最新队旗、图池/队伍信息的压缩包。

完整压缩包除了这个仓库里包含的static资源文件之外，还应该包含tosu/gosu的二进制文件。

开播前的操作步骤如下：

1. （与往届直播一致）下载并导入本轮图包，并且设置好直播端（比赛名MP5，对阵3v3，分辨率建议1080）。
*如果你的屏幕是2k或有多屏幕，一般使用1080分辨率即可；如果你是单屏1080，那么直播端分辨率建议使用900或720。
2. 打开OBS，点击导航栏中的【场景集合】→【导入】，然后选择static目录下的MP5_OBS_SCENE_COLLECTION.json文件并导入（对于直播端分辨率为1080的，导入以上文件即可；如果是720或者900，则要导入对应的文件，具体看文件名前缀）；
3. （如果你的混音器为空）在【设置】→【音频】页面中，启用你自己的扬声器和麦克风设备；
4. 配置直播弹幕：进入PLAYING场景，双击来源中【弹幕】，将其地址改为你的在线弹幕姬地址（这里建议使用https://chat.bilisc.com，按照该网站的提示进行操作，你将获得一个房间URL，使用该URL即可）。如果你习惯使用其他弹幕姬，也可以自行配置（此时注意修改自定义CSS）。
---
（如果你已经用过直播包，则从这里开始）

*如果你使用的是之前轮次的直播包，则执行以下步骤：
从群里下载新的bracket.json文件，并替换掉本地mp5-stream-overlay/COMMON/data/目录下的同名文件即可。

---
（如果你已经用过本轮直播包，则从这里开始）

5. 先启动tosu，后启动obs；启动osu stable直播端；推流前检查每个场景是否正常显示（不是404、一片空白等），如果有问题可以尝试在obs内选中来源后点击刷新。
6. 修改直播端内的BO数为当前比赛的BO数。
7. 切换到PLAYING场景，选择浏览器源，点击obs的交互按钮，设置当前比赛阶段。
8. 切换到BAN_PICK场景，选择浏览器源，点击obs的交互按钮，设置当前图池轮次。

---
（以下为开播后）

9. 比赛正式开始Ban Pick之前，使用场景集合附带的MP5_WAITING_POSTER场景轮播海报；
10. 如果方便的话，开始Ban Pick之前介绍一下赞助方猫盘，可以简单说两句感谢猫盘赞助，也可以参考以下文案：
『MeowPad是由大家耳熟能详的猫猫bot团队所开发的磁轴RT小键盘，有价格比较低的3Key入门版，和延迟更低、3+1Key多间距适配的进阶版本。
MeowPad经过大量osu!玩家验证， 性能和工艺都很棒，另外他们制作的64配列大键盘也已经上架，欢迎大家购买。』
11. 开始比赛后，根据比赛情况，在PLAYING场景 / BAN_PICK场景做切换，并且根据裁判指令，与网页交互，展示BP行为等。

---
（如果你要直播Showcase，则从这里开始）

1. 修改osu!目录下的osu!<你的用户名>.cfg，将分辨率调整为**1920x950(必须)**
2. 启动tosu和osu!，导入第一个Replay，推流前检查SHOWCASE_INFO和SHOWCASE_PLAYING场景是否正常显示；
3. 在介绍谱面时，使用SHOWCASE_INFO场景大屏展示谱面信息；
4. 在播放Replay时，使用SHOWCASE_PLAYING场景展示Replay。
---

### 直播员小抄

1. 如果tosu启动后读取完第一个osu!的内存就立刻闪退： 重复启动tosu几次，还不行就试试给static改个名，启动tosu后再删掉生成的static目录并且改回来;
   或者删掉config.ini，然后寻找并换用gosu。*tosu的新版本似乎修复了这个问题，后续不会再默认提供gosu。*


2. 如果你发现BAN_PICK场景下，当前比赛使用的图池轮次并未包含在直播包中，请要求比赛工作人员提供更新。

---

### 比赛工作人员部分

#### 【图池轮次】

当比赛推进到使用下一轮图池时，需要去Pata-Mon开发的[简易Bracket生成器](https://mp5tournament.github.io/streaming_config/)
根据最新的图池信息生成新的JSON。

目前我们使用rosu-pp读取.osu文件进行计算，不依赖完整的bracket.json，因此无需使用Lazer直播端进行完善。

如果是MP5比赛，则Pata-Mon会负责维护MP5的bracket，一键导出即可。 **生成或导出时必须使用API
Key，否则bracket不包含玩家uid，会导致BAN_PICK场景队员头像无法显示。**

你也可以直接使用osu!Lazer 的直播端模式，手动编辑图池、队伍、队员等信息。*不需要包含对阵、晋级信息，这套界面不需要这些数据。*

新的bracket.json需要替换到`static/COMMON/data`下面。

#### 【离线图相关】

由于MP5特有的歌曲竞猜机制，在Showcase开始前部分谱面不会被上传到官网，此时没有谱面ID。

工作人员需要编辑`static/COMMON/data/mapmock.json`，手动添加离线谱面的信息，以使Showcase相关场景可以正确读取谱面的MOD信息。

#### 【打包】

更新完这2个JSON文件后，将上方给直播员看的说明、小抄剪切到单独的直播员指南.txt文件里，再将static目录下的所有文件和tosu的二进制文件一起压缩为zip文件，作为直播包。

也可以使用[Github Action](https://github.com/Mother-Ship/mp5-stream-overlay/actions/workflows/main.yml)，如果有本仓库权限，可以通过push代码触发；否则也可以在Action打完的压缩包基础上替换json。

示例目录结构：

```
static/
tosu.exe
gosumemory.exe
README.md
```

你也可以单独向你的直播员提供这2个JSON文件，让直播员自行更新。

---

## 其他比赛二次修改、打包指南

---

### 【比赛Logo】

在`static/COMMON/img/`下有2个Logo文件。

logo.png会被放在PLAYING场景左上方，而logo2.png会以水印的形式，出现在PLAYING和SHOWCASE_PLAYING的弹幕区域 ~~、魔法区域。~~

这2个图片需要替换成你自己的logo，要求透明背景，比例与现有的近似即可。

### 【魔法】
MP5 S21已经去掉了魔法相关功能，再次感谢forpahe!
 
~~PLAYING场景包含了大量的【场地魔法】相关操作，这是为MP5 Mystic Arena II定做的需求，如果你不需要，可以剔除。~~

~~大致有控制台的魔法选择、左下角的魔法名展示、底部的魔法说明、选择魔法后出现的弹窗这几部分。~~

~~另外`static/COMMON/data`里有一个场地魔法列表，以及`static/COMMON/lib`里还有读取魔法列表的工具。~~

### 【赛制与比赛阶段】

PLAYING场景的控制台包含了比赛阶段的控制，选择后，按钮的文本会出现在场景顶部，如果预设的按钮没有包含你的比赛的阶段，则根据需要来增删按钮即可。

### 【bracket.json】

参考上方比赛工作人员部分，使用[简易Bracket生成器](https://mp5tournament.github.io/streaming_config/)
或Lazer直播端生成bracket.json，并替换到`static/COMMON/data`下面。

注意：
PLAYING场景**未对离线谱面做兼容**，如果你的比赛**在开打阶段**仍然有未上传到官网的谱面，可参考SHOWCASE_PLAYING场景，对PLAYING场景做修改
（应当只需要添加 `mock.updateProperties(parsed);`即可）。

### 【场景集合】

你可以在[MP5_OBS_SCENE_COLLECTION.json](MP5_OBS_SCENE_COLLECTION.json)的基础上进行重命名、添加你自己的元素。

目前的场景集合为3V3比赛做了适配，如果你的比赛不是3V3，则需要自行使用OBS编辑场景集合，将游戏客户端放在合适的位置。

### 【打包】
检查完所有的改动后，将上方给直播员看的说明、小抄剪切到单独的直播员指南.txt文件里，再将static目录下的所有文件和tosu的二进制文件一起压缩为zip文件，作为直播包，分发给你的直播员。
