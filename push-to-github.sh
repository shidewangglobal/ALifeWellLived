#!/bin/bash
# Chạy từng khối lệnh theo thứ tự (copy từng khối vào Terminal, Enter).

# ========== BƯỚC 1: Vào đúng thư mục ==========
cd "/Users/DatVuong/Library/Mobile Documents/com~apple~CloudDocs/Documents/WORK/AI DIGITAL CURSOR/joy/scripts"

# ========== BƯỚC 2: Khởi tạo Git và thêm file ==========
git init
git add .

# ========== BƯỚC 3: Commit ==========
git commit -m "Joy - A Life Well Lived - Sống Chất"

# ========== BƯỚC 4: Kết nối repo GitHub (địa chỉ của bạn) ==========
git remote add origin https://github.com/shidewangglobal/ALifeWellLived.git

# Nếu báo "remote origin already exists" thì chạy lệnh này thay vì lệnh trên:
# git remote set-url origin https://github.com/shidewangglobal/ALifeWellLived.git

# ========== BƯỚC 5: Đặt nhánh main và đẩy lên ==========
git branch -M main

# Repo đã có README: gộp nhánh (merge) rồi đẩy
git merge origin/main --allow-unrelated-histories -m "Merge with repo README"

git push -u origin main
