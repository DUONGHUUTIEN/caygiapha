const express = require('express');
const app = express();
const path = require('path');

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware để xử lý form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Define the homepage route
app.get('/', (req, res) => {
    res.render('index');
});

// Define the family tree visualization route
app.get('/tree', (req, res) => {
    res.render('tree');
});

// Import and use the tree routes
const treeRoutes = require('./routes/tree');
app.use('/api/tree', treeRoutes);

// Members API and page
const membersRoutes = require('./routes/members');
app.use('/api/members', membersRoutes);
app.get('/members', (req, res) => {
    res.render('members');
});

// Events API and page
const eventsRoutes = require('./routes/events');
app.use('/api/events', eventsRoutes);
app.get('/events', (req, res) => {
    res.render('events');
});
app.get('/events/list', (req, res) => {
    res.render('events-list');
});

// Update routes for login and register
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    // Tạm thời chuyển hướng về trang chủ sau khi đăng nhập
    // TODO: Thêm xử lý đăng nhập thực tế ở đây
    res.redirect('/');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    // Tạm thời chuyển hướng về trang đăng nhập sau khi đăng ký
    // TODO: Thêm xử lý đăng ký thực tế ở đây
    res.redirect('/login');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});