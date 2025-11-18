const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const dataFile = path.join(__dirname, '..', 'data', 'family.json');

// ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { /* ignore */ }
}

function readTree() {
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading family data:', err);
        return null;
    }
}

function writeTree(tree) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(tree, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing family data:', err);
        return false;
    }
}

// GET tree data
router.get('/data', (req, res) => {
    const tree = readTree();
    if (!tree) return res.status(500).json({ error: 'Could not read tree data' });
    res.json(tree);
});

// POST upload image as base64 data URL -> saves file and returns public URL
router.post('/upload', express.json({ limit: '12mb' }), (req, res) => {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl required' });

    // dataUrl example: data:image/png;base64,....
    const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid dataUrl' });

    const mime = matches[1];
    const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
    const b64 = matches[3];
    const buffer = Buffer.from(b64, 'base64');
    const filename = `img_${Date.now()}.${ext}`;
    const outPath = path.join(uploadsDir, filename);

    try {
        fs.writeFileSync(outPath, buffer);
        const publicUrl = `/images/uploads/${filename}`;
        return res.json({ url: publicUrl });
    } catch (err) {
        console.error('Failed to save image', err);
        return res.status(500).json({ error: 'Failed to save image' });
    }
});

// Helper: find node by path of indices (e.g. [0,1])
function findNodeByPath(root, path) {
    let node = root;
    for (let idx of path) {
        if (!node.children || !node.children[idx]) return null;
        node = node.children[idx];
    }
    return node;
}

// POST add a child node. Body: { path: [indices], node: { name, birthYear, gender }, relation }
router.post('/add', (req, res) => {
    const { path: nodePath = [], node, relation = 'child' } = req.body;
    if (!node || !node.name) return res.status(400).json({ error: 'Node with name required' });

    const tree = readTree();
    if (!tree) return res.status(500).json({ error: 'Could not read tree data' });

    const newNode = {
        name: node.name,
        children: []
    };
    
    // Add optional fields
    if (node.birthYear) newNode.birthYear = node.birthYear;
    if (node.gender) newNode.gender = node.gender;
    if (node.description) newNode.description = node.description;
    if (node.image) newNode.image = node.image;

    if (relation === 'spouse') {
        // add spouse to the node at nodePath
        const target = findNodeByPath(tree, nodePath);
        if (!target) return res.status(400).json({ error: 'Target path not found' });
        if (target.spouse) return res.status(400).json({ error: 'Spouse already exists' });
        target.spouse = { name: node.name };
        if (node.birthYear) target.spouse.birthYear = node.birthYear;
        if (node.gender) target.spouse.gender = node.gender;
        if (node.description) target.spouse.description = node.description;
        if (node.image) target.spouse.image = node.image;
    } else if (relation === 'parent') {
        // add a parent above the node at nodePath
        const newParent = { name: node.name, children: [] };
        if (node.birthYear) newParent.birthYear = node.birthYear;
        if (node.gender) newParent.gender = node.gender;
        if (node.description) newParent.description = node.description;
        if (node.image) newParent.image = node.image;
        
        if (nodePath.length === 0) {
            // new root becomes newParent with old root as its child
            newParent.children.push(tree);
            // write newParent as the whole tree root
            if (!writeTree(newParent)) return res.status(500).json({ error: 'Could not write tree data' });
            return res.json(newParent);
        } else {
            const parentPath = nodePath.slice(0, -1);
            const idx = nodePath[nodePath.length - 1];
            const parentContainer = parentPath.length === 0 ? tree : findNodeByPath(tree, parentPath);
            if (!parentContainer || !parentContainer.children || parentContainer.children.length <= idx) return res.status(400).json({ error: 'Path not found' });
            const oldNode = parentContainer.children[idx];
            newParent.children.push(oldNode);
            // replace oldNode with newParent
            parentContainer.children.splice(idx, 1, newParent);
        }
    } else {
        // default: child
        if (nodePath.length === 0) {
            // add as root's child
            tree.children = tree.children || [];
            tree.children.push(newNode);
        } else {
            const parent = findNodeByPath(tree, nodePath);
            if (!parent) return res.status(400).json({ error: 'Parent path not found' });
            parent.children = parent.children || [];
            parent.children.push(newNode);
        }
    }

    if (!writeTree(tree)) return res.status(500).json({ error: 'Could not write tree data' });
    res.json(readTree());
});

// PUT update a node's information. Body: { path: [indices], name, birthYear, deathYear, gender, description, image, relation }
router.put('/update', (req, res) => {
    // Support two payload shapes:
    // 1) legacy: { path, name, birthYear, deathYear, gender, description, image, relation }
    // 2) unified: { path, updates: { name?, birthYear?, ... }, relation }
    const { path: nodePath = [], updates, relation = 'self' } = req.body;

    const tree = readTree();
    if (!tree) return res.status(500).json({ error: 'Could not read tree data' });

    // Helper to safely convert year
    const parseYear = (val) => {
        if (val === null || val === undefined || val === '') return null;
        const num = parseInt(val);
        return isNaN(num) ? null : num;
    };

    // If legacy payload (no updates) map fields
    let normalized = {};
    if (updates && typeof updates === 'object') {
        normalized = Object.assign({}, updates);
        if ('birthYear' in normalized) normalized.birthYear = parseYear(normalized.birthYear);
        if ('deathYear' in normalized) normalized.deathYear = parseYear(normalized.deathYear);
    } else {
        // legacy handling: copy known fields from req.body
        const { name, birthYear, deathYear, gender, description, image } = req.body;
        if (typeof name === 'string') normalized.name = name;
        if (birthYear !== undefined) normalized.birthYear = parseYear(birthYear);
        if (deathYear !== undefined) normalized.deathYear = parseYear(deathYear);
        if (gender !== undefined) normalized.gender = gender || null;
        if (description !== undefined) normalized.description = description || null;
        if (image !== undefined) normalized.image = image || null;
    }

    try {
        if (relation === 'spouse') {
            const target = findNodeByPath(tree, nodePath);
            if (!target || !target.spouse) return res.status(400).json({ error: 'Spouse not found' });
            // assign fields
            Object.keys(normalized).forEach(k => { target.spouse[k] = normalized[k]; });
        } else if (relation === 'self') {
            const node = findNodeByPath(tree, nodePath);
            if (!node) return res.status(400).json({ error: 'Node path not found' });
            Object.keys(normalized).forEach(k => { node[k] = normalized[k]; });
        } else {
            return res.status(400).json({ error: 'Invalid relation for update' });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Update failed', details: err.message });
    }

    if (!writeTree(tree)) return res.status(500).json({ error: 'Could not write tree data' });
    res.json(readTree());
});

// DELETE a node. Body: { path: [indices] }
router.delete('/delete', (req, res) => {
    const { path: nodePath = [], relation = 'self' } = req.body;
    if (!Array.isArray(nodePath) || nodePath.length === 0) return res.status(400).json({ error: 'Path required' });

    const tree = readTree();
    if (!tree) return res.status(500).json({ error: 'Could not read tree data' });

    if (relation === 'spouse') {
        const target = findNodeByPath(tree, nodePath);
        if (!target || !target.spouse) return res.status(400).json({ error: 'Spouse not found' });
        delete target.spouse;
    } else {
        // remove the node from its parent's children
        const parentPath = nodePath.slice(0, -1);
        const removeIdx = nodePath[nodePath.length - 1];
        const parent = parentPath.length === 0 ? tree : findNodeByPath(tree, parentPath);
        if (!parent || !parent.children || parent.children.length <= removeIdx) return res.status(400).json({ error: 'Path not found' });

        parent.children.splice(removeIdx, 1);
    }

    if (!writeTree(tree)) return res.status(500).json({ error: 'Could not write tree data' });
    res.json(readTree());
});

module.exports = router;