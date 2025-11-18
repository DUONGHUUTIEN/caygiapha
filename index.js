const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const session = require('express-session');

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware để xử lý form data
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// =======================
// User data handling
// =======================
const USERS_FILE = path.join(__dirname, "data", "users.json");

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// =======================
// Routes
// =======================

// Homepage
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Family tree visualization
app.get('/tree', (req, res) => {
    res.render('tree', { user: req.session.user });
});

// Import and use tree routes
const treeRoutes = require('./routes/tree');
app.use('/api/tree', treeRoutes);

// Members API and page
const membersRoutes = require('./routes/members');
app.use('/api/members', membersRoutes);
app.get('/members', (req, res) => {
    res.render('members', { user: req.session.user });
});

// Events API and page
const eventsRoutes = require('./routes/events');
app.use('/api/events', eventsRoutes);
app.get('/events', (req, res) => {
    res.render('events', { user: req.session.user });
});

app.get('/events/list', (req, res) => {
    res.render('events-list', { user: req.session.user });
});

// =======================
// LOGIN & REGISTER
// =======================

// Login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// =======================
// XỬ LÝ ĐĂNG NHẬP (Đã sửa lỗi hiển thị)
// =======================
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    let users = loadUsers();
    
    // Tìm user khớp cả email và password
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        // --- KHẮC PHỤC LỖI CHUYỂN TRANG ---
        // Nếu sai tài khoản/mật khẩu: Gửi Alert báo lỗi rồi quay về trang chủ
        return res.send(`
            <script>
                alert("Đăng nhập thất bại: Sai email hoặc mật khẩu!");
                window.location.href = "/";
            </script>
        `);
    }

    // Nếu đăng nhập thành công
    req.session.user = user;
    
    // Lưu session và chuyển hướng về trang chủ
    req.session.save((err) => {
        res.redirect('/');
    });
});

// Register page
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// =======================
// XỬ LÝ ĐĂNG KÝ (Quy trình chuẩn: Đăng ký xong -> Bắt đăng nhập lại)
// =======================
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;

    let users = loadUsers();

    // 1. Kiểm tra trùng email (Giữ nguyên logic cũ)
    const exists = users.find(u => u.email === email);
    if (exists) {
        return res.send(`
            <script>
                alert("Lỗi: Email này đã được đăng ký! Vui lòng chọn email khác.");
                window.location.href = "/";
            </script>
        `);
    }

    // 2. Tạo user mới và lưu vào file
    const newUser = { name, email, password };
    users.push(newUser);
    saveUsers(users);

    // --- SỬA ĐỔI QUAN TRỌNG Ở ĐÂY ---
    // Trước đây: req.session.user = newUser; (Tự động đăng nhập -> XÓA DÒNG NÀY)
    
    // Bây giờ: Chỉ thông báo thành công và đẩy về trang chủ
    res.send(`
        <script>
            alert("Đăng ký thành công! Vui lòng đăng nhập tài khoản mới của bạn.");
            window.location.href = "/";
        </script>
    `);
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// =======================
// Start the server
// =======================
const PORT = process.env.PORT || 3000;
// =======================
// LOGOUT HANDLING (Thêm đoạn này vào)
// =======================
app.get('/logout', (req, res) => {
    // Hủy session lưu trạng thái đăng nhập
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/');
        }
        // Xóa cookie và quay về trang chủ
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
