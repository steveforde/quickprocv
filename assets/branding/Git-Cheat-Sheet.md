# 🧠 QuickProCV Git Cheat Sheet

## ✅ 1. Check Current Branch and Status
```bash
git status
```
- See which branch you're on
- View changed, staged, or uncommitted files

---

## 🔄 2. Save All Changes with a Message
```bash
git add .
git commit -m "WIP: token tracker update"
```
- `git add .`: Stages all changes
- `git commit -m "..."`: Saves your changes with a message

---

## ☁️ 3. Push Changes to GitHub
```bash
git push
```
- Sends your local commits to the remote branch on GitHub

---

## 🌿 4. Switch to Another Branch
```bash
git checkout working-system
```

🟡 If it gives an error ("Your local changes..."):
```bash
git add .
git commit -m "Saving before switch"
git checkout working-system
```

---

## 🔀 5. Merge Another Branch into Current Branch
```bash
git merge ai-updates
```
- Example: You’re on `main` and want changes from `ai-updates`

---

## 🆕 6. Create and Switch to a New Branch
```bash
git checkout -b backup-working-system
```

---

## 🗑️ 7. Delete a Branch (Only if safe)
```bash
git branch -d branch-name        # Safe delete (fully merged)
git branch -D branch-name        # Force delete (not merged)
```

---

## 📋 8. View All Local Branches
```bash
git branch
```

---

## 📤 9. Push New Branch to GitHub
```bash
git push -u origin branch-name
```

---

## 🛟 Bonus: Undo Last Commit (Safe, Keeps Changes)
```bash
git reset --soft HEAD~1
```

---
Made for **QuickProCV** 🚀