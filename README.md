


---
如果你是直播员
1. 使用OBS导入场景集合（JSON文件）
2. 提示缺少文件时，点击查找文件夹，选择你解压出来的目录中和场景集合同级的OBS Assets文件夹
3. 在OBS设置->音频里添加你自己的扬声器和麦克风设备
4. 启动tosu和直播端，开播前检查每个场景是否正常
---
（如果你已经用过直播包，现在需要播另一场比赛，则从这里开始）
5. 修改Stable直播端内的BO数为当前比赛的BO数
6. 切换到PLAYING场景，选择浏览器源，点击obs的交互按钮，设置当前比赛阶段
7. 切换到BAN_PICK场景，选择浏览器源，点击obs的交互按钮，设置当前图池轮次
---
当比赛推进到使用下一轮图池时，需要去https://mp5tournament.github.io/streaming_config/ 生成新的JSON
新的JSON需要替换到/COMMON/data下面
（必须使用API Key，否则bracket不包含UID会导致BAN_PICK场景队员头像无法显示）

---
如果tosu启动立刻闪退，重复启动几次，还不行就删掉config.ini，然后启动gosu；
或者试试给static改个名，启动tosu后再删掉生成的static目录并且改回来

---
开始Ban Pick之前使用MP5_WAITING_POSTER场景；准备开始Ban Pick之前介绍一下赞助方猫盘，文案：

MeowPad是由大家耳熟能详的猫猫bot团队所开发的磁轴RT小键盘，
有价格比较低的3Key入门版，和延迟更低、3+1Key多间距适配的进阶版本。
MeowPad经过大量osu!玩家验证， 性能和工艺都很棒，另外他们制作的64配列大键盘也即将上架，大家可以期待一下。

---
如果你要用直播包二次修改给别的比赛用
1. 替换bracket.json为你自己的，必须包括队伍、队员、图池轮次、谱面信息，可以用https://mp5tournament.github.io/streaming_config/编辑（必须提供api v1 key）
2. 替换队旗为你自己的，队旗名字用bracket.json里的Acronym字段
3. playing 和showcase_playing的背景有这届MP5的徽标剪影，是和背景切在同一个图的，其他比赛要用要换掉