# EVA Lucky Tetris 网页部署指南

游戏是纯静态页面（HTML + CSS + JS），无需服务器，可免费部署到以下任一平台。

---

## 方式一：GitHub Pages（免费，适合已有 GitHub）

### 1. 准备文件
确保这三个文件在同一目录下：
- `index.html`
- `style.css`
- `main.js`

### 2. 创建仓库并上传
1. 在 [GitHub](https://github.com) 新建一个仓库（例如 `eva-lucky-tetris`）
2. 把上述三个文件放进仓库**根目录**（不要放在子文件夹里）
3. 可选：把 `prompt.txt`、`tetris.html` 等不用于游戏的文件排除或删掉，避免仓库杂乱

### 3. 开启 GitHub Pages
1. 进入仓库 → **Settings** → **Pages**
2. 在 **Source** 选择 **Deploy from a branch**
3. **Branch** 选 `main`（或 `master`），文件夹选 **/ (root)**，保存
4. 等 1～2 分钟，页面会显示：`https://你的用户名.github.io/eva-lucky-tetris/`

之后每次 push 到该分支，网站会自动更新。

---

## 方式二：Netlify（免费，拖拽上传即可）

### 1. 打包要部署的文件
把 **index.html、style.css、main.js** 放在同一个文件夹里（可以就叫 `eva-tetris`）。

### 2. 上传到 Netlify
1. 打开 [Netlify](https://www.netlify.com) 并登录（可用 GitHub 登录）
2. 点击 **Add new site** → **Deploy manually**
3. 把包含上述三个文件的**文件夹**拖进页面（或选中该文件夹上传）
4. 部署完成后会得到一个随机网址，例如：`https://随机名字.netlify.app`

### 3. 自定义网址（可选）
在 **Site settings** → **Domain management** → **Options** → **Edit site name**，可改成例如：`eva-lucky-tetris.netlify.app`。

---

## 部署后检查

- 用手机和电脑浏览器各打开一次网址，确认能正常进入游戏
- 试一下：移动、旋转、消行、Hold、暂停、Game Over 后点「重新开始」

---

## 自定义域名（可选）

若你有自己的域名（如 `evatetris.com`）：
- **Netlify**：在 Domain management 里添加你的域名，按提示解析 DNS
- **GitHub Pages**：在仓库 Settings → Pages 的 Custom domain 里填写域名，并在域名服务商处添加 CNAME 记录

---

## 小结

| 方式          | 优点               | 适合场景           |
|---------------|--------------------|--------------------|
| **GitHub Pages** | 和代码一起管理、自动更新 | 习惯用 Git/GitHub  |
| **Netlify**   | 不用 Git 也能拖拽部署   | 想最快上线、不写命令 |

两种方式都是免费、支持 HTTPS，选一种按步骤做即可让很多人通过链接玩到你的游戏。
