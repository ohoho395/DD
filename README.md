# 幻兽帕鲁图鉴助手

一个适合在 macOS 和 Windows 上本地运行的小工具，围绕四个高频需求做：

- 图鉴检索
- 打工推荐
- 配种查询
- 词条继承规划

## 当前版本包含什么

- 全量帕鲁条目检索
- 打工适应性速看
- 前 / 中 / 后期入手阶段筛选
- 夜行筛选
- 牧场常用位清单
- 精确配种组合查询
- 父母反查子代
- 配种结果排序 / 收藏 / 常用亲本记忆
- 词条继承攻略
- 每只帕鲁的本地地图和本地同步缓存

## GitHub Actions 原生打包

仓库内已经带好 GitHub Actions 工作流：

- 推送到 `main` 后会自动构建
- 也可以在 Actions 页面手动触发 `Build Native Desktop Packages`
- 构建完成后会自动刷新 `Releases` 里的 `Latest Build` 预发布版本
- `Releases` 页面会直接提供两个下载包：
  - `PalworldDexHelper-macOS-native.zip`
  - `PalworldDexHelper-Windows-native.zip`

下载入口：

- `Releases`：`https://github.com/ohoho395/DD/releases`
- `Actions`：`https://github.com/ohoho395/DD/actions`

## 本地原生构建

如果你想要原生桌面产物：

- macOS `.app`：运行 `build_macos_app.command`
- Windows `.exe`：把项目拷到 Windows 后运行 `build_windows_exe.bat`

补充说明见：

- `README-native.md`

## 运行方式

最完整的启动方式是运行：

- Windows: 双击 `start_helper.bat`
- macOS: 双击 `start_helper.command`

这样会启动一个本地服务并自动打开浏览器，页面里的“一键同步”按钮才能正常工作。

如果你只是想离线查看，也可以直接双击 `index.html`，但这种模式下页面里的同步按钮不可用。

如果你后面想自己刷新原始数据，再执行下面这一步：

```bash
python3 build_data.py
```

如果你想把 `paldb.cc` 上的岗位榜单、掉落和刷新信息同步进本地缓存，再执行：

```bash
python3 sync_paldb.py
```

Windows 上也可以直接双击同目录下的 `sync_paldb.bat`。
macOS 上则可以双击 `sync_paldb.command`。

如果你是通过 `start_helper.bat` 启动的，也可以直接在页面顶部点“一键同步 paldb.cc”。

## 数据来源

- `palcalc` 开源数据
- `paldb.cc` 公开页面与地图资源

- [tylercamp/palcalc](https://github.com/tylercamp/palcalc)
- [paldb.cc](https://paldb.cc/)

这样做的原因是：帕鲁刷新和榜单信息更容易随版本变化，把它们做成“可重跑同步”的缓存会比手抄一份死数据更稳。

## 后续可以继续加

- 属性 / 坐骑 / 战斗定位筛选
- 被动词条继承辅助
- 多步配种链推荐
- 收藏夹和自定义目标清单
