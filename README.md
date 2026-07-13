# 空间站

阿杨 & 阿冯的情侣小站：在一起天数、行事历、攒钱。

- 双击 `index.html` 可本机打开
- 配好 Firebase 后，两人打开同一网址即可共用数据
- 可部署到 GitHub Pages

---

## 一、开通双人同步（Firebase，免费）

1. 打开 [Firebase 控制台](https://console.firebase.google.com/)，用 Google 账号登录  
2. **创建项目**（名字随意，如 `kongjianzhan`）  
3. 左侧：**构建 → Realtime Database → 创建数据库**  
   - 地区可选 `singapore` 或其它  
   - 开始模式先选 **测试模式**（后面会改规则）  
4. 项目设置（齿轮）→ **您的应用** → 选 **</> Web**  
   - 应用昵称随意，不用勾选 Firebase Hosting  
   - 创建后会得到一段 `firebaseConfig`  
5. 打开本目录的 `config.js`，把对应字段粘进去，例如：

```js
firebase: {
  apiKey: '粘贴这里',
  authDomain: 'xxx.firebaseapp.com',
  databaseURL: 'https://xxx-default-rtdb.xxx.firebasedatabase.app',
  projectId: 'xxx',
  storageBucket: 'xxx.appspot.com',
  messagingSenderId: '数字',
  appId: '1:数字:web:xxx',
},
```

6. Realtime Database → **规则**，改成下面这样后发布：

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

7. 刷新网页。左下角显示 **「云端已同步 · 两人共用」** 即成功。

> `roomId` 相当于你们的小房间密码，不要公开发给外人。

---

## 二、部署到 GitHub Pages（让对方用网址打开）

1. 在 GitHub 新建一个仓库，例如 `kongjianzhan`（可 Private）  
2. 在本文件夹打开终端，执行：

```bash
cd ~/Desktop/空间站
git init
git add .
git commit -m "空间站：首页日历与攒钱，支持云端同步"
git branch -M main
git remote add origin https://github.com/你的用户名/kongjianzhan.git
git push -u origin main
```

3. GitHub 仓库 → **Settings → Pages**  
   - Source 选 **Deploy from a branch**  
   - Branch 选 `main` / `/ (root)` → Save  
4. 几分钟后得到网址，类似：  
   `https://你的用户名.github.io/kongjianzhan/`  
5. 把这个网址发给对方即可。

两边都要用**同一个** `config.js`（同一套 Firebase + 同一个 `roomId`）。

---

## 本地文件

| 文件 | 作用 |
|---|---|
| `index.html` | 页面 |
| `style.css` | 样式 |
| `app.js` | 逻辑 |
| `config.js` | 房间号 + Firebase 配置 |
