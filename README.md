## MP5专用直播自定义Overlay

这套自定义界面包含了4个场景需要的浏览器Overlay：

- BAN_PICK，用于展示双方选图
- SHOWCASE_INFO，用于Showcase时展示谱面信息
- PLAYING，用于正式比赛时展示信息
- SHOWCASE_PLAYING，用于Showcase播放Replay时展示信息

以及一个广告轮播场景需要的静态资源：

- WAITING_POSTER （该场景需要用到的资源在OBS Assets目录下）

这套界面由foraphe和我在MP5 Mystic Arena II的开赛前和比赛中迭代开发，非常感谢foraphe的大力支持，他在歌曲数据计算和离线图兼容上做了大量的工作。

本届MP5是一场4V4比赛，除了正常的双败淘汰赛制外，还加入了场地魔法、歌曲竞猜机制，因此这套界面也提供了对应的功能、兼容性改造等。

如果你是其他MeowDevice赞助比赛的工作人员，可以遵循下方的指引，轻松的将这套界面移植到你自己的比赛。

## 使用方法

---

### 操作步骤

如果你是直播员，你应该会在MP5的Staff/直播群找到完整的压缩包。

完整压缩包除了这个仓库里包含的static资源文件之外，还应该包含tosu/gosu的二进制文件。

开播前的操作步骤如下：

1. 使用OBS导入场景集合（static目录下的[MP5_OBS_SCENE_COLLECTION.json](MP5_OBS_SCENE_COLLECTION.json)文件）；
2. 提示缺少文件时，点击查找文件夹，选择static目录中的OBS Assets文件夹；
3. 在OBS设置->音频里添加你自己的扬声器和麦克风设备；
---
（如果你已经用过直播包，现在需要播同一届比赛的另一场比赛，则从这里开始）

4. 启动tosu和直播端，推流前检查每个场景是否正常显示（不是404、一片空白等）。
5. 修改Stable直播端内的BO数为当前比赛的BO数；
6. 启动你自己惯用的在线弹幕姬软件，将直播间弹幕放置在PLAYING场景的合适位置；
7. 切换到PLAYING场景，选择浏览器源，点击obs的交互按钮，设置当前比赛阶段。
8. 切换到BAN_PICK场景，选择浏览器源，点击obs的交互按钮，设置当前图池轮次。
9. 根据比赛情况，在PLAYING场景 / BAN_PICK场景做切换，并且根据裁判指令，与网页交互，展示BP行为、魔法选择等。

---
（如果你要直播Showcase，则从这里开始）

4. 修改osu!目录下的osu!<你的用户名>.cfg，将分辨率调整为1920x950(必须)
5. 启动tosu和osu!，导入第一个Replay，推流前检查SHOWCASE_INFO和SHOWCASE_PLAYING场景是否正常显示；
6. 在介绍谱面时，使用SHOWCASE_INFO场景大屏展示谱面信息；
7. 在播放Replay时，使用SHOWCASE_PLAYING场景展示Replay。
---

### 直播员小抄

1. 如果tosu启动后读取完第一个osu!的内存就立刻闪退： 重复启动tosu几次，还不行就试试给static改个名，启动tosu后再删掉生成的static目录并且改回来;
   或者删掉config.ini，然后换用gosu。

2. 比赛正式开始Ban Pick之前，使用场景集合附带的MP5_WAITING_POSTER场景轮播海报；

3. 准备开始Ban Pick之前介绍一下赞助方猫盘，文案如下：

```
MeowPad是由大家耳熟能详的猫猫bot团队所开发的磁轴RT小键盘，
有价格比较低的3Key入门版，和延迟更低、3+1Key多间距适配的进阶版本。
MeowPad经过大量osu!玩家验证， 性能和工艺都很棒，另外他们制作的64配列大键盘也即将上架，大家可以期待一下。
```

4. 如果你发现BAN_PICK场景下，当前比赛使用的图池轮次并未包含在直播包中，请要求比赛工作人员提供更新。

---

### 比赛工作人员部分

#### 【图池轮次】

当比赛推进到使用下一轮图池时，需要去Pata-Mon开发的[简易Bracket生成器](https://mp5tournament.github.io/streaming_config/)
根据最新的图池信息生成新的JSON。

目前我们使用rosu-pp读取.osu文件进行计算，不依赖完整的bracket.json，因此无需使用Lazer直播端进行完善。

如果是MP5比赛，则Pata-Mon会负责维护MP5的bracket，一键导出即可。 **生成或导出时必须使用API
Key，否则bracket不包含玩家uid，会导致BAN_PICK场景队员头像无法显示。**

你也可以直接使用osu!Lazer 的直播端模式，手动编辑图池、队伍、队员等信息。不需要包含对阵、晋级信息，这套界面不需要这些数据。

新的bracket.json需要替换到`static/COMMON/data`下面。

#### 【离线图相关】

由于MP5特有的歌曲竞猜机制，在Showcase开始前部分谱面不会被上传到官网，此时没有谱面ID。

工作人员需要编辑`static/COMMON/data/mapmock.json`，手动添加离线谱面的信息，以使Showcase相关场景可以正确读取谱面的MOD信息。

#### 【打包】

更新完这2个JSON文件后，将上方给直播员看的说明、小抄剪切到单独的README.md文件里，再将static目录下的所有文件和tosu/gosu的二进制文件一起压缩为zip文件，作为直播包。

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

logo.png会被放在PLAYING场景左上方，而logo2.png会以水印的形式，出现在PLAYING和SHOWCASE_PLAYING的弹幕区域、魔法区域。

这2个图片需要替换成你自己的logo，要求透明背景，比例与现有的近似即可。

### 【魔法】

PLAYING场景包含了大量的【场地魔法】相关操作，这是为MP5 Mystic Arena II定做的需求，如果你不需要，可以剔除。

大致有控制台的魔法选择、左下角的魔法名展示、底部的魔法说明、选择魔法后出现的弹窗这几部分。

另外`static/COMMON/data`里有一个场地魔法列表，以及`static/COMMON/lib`里还有读取魔法列表的工具。

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

目前的场景集合为4V4比赛做了适配，如果你的比赛不是4V4，则需要自行使用OBS编辑场景集合，将游戏客户端放在合适的位置。

### 【打包】
检查完所有的改动后，将上方给直播员看的说明、小抄剪切到单独的README.md文件里，再将static目录下的所有文件和tosu/gosu的二进制文件一起压缩为zip文件，作为直播包，分发给你的直播员。