const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const dataFile = path.join(__dirname, '..', 'data', 'family.json');

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

// Helper: find node by path of indices (e.g. [0,1])
function findNodeByPath(root, path) {
    let node = root;
    for (let idx of path) {
        if (!node.children || !node.children[idx]) return null;
        node = node.children[idx];
    }
    return node;
}

// POST add a child node. Body: { path: [indices], node: { name } }
router.post('/add', (req, res) => {
    const { path: nodePath = [], node, relation = 'child' } = req.body;
    if (!node || !node.name) return res.status(400).json({ error: 'Node with name required' });

    const tree = readTree();
    if (!tree) return res.status(500).json({ error: 'Could not read tree data' });

    if (relation === 'spouse') {
        // add spouse to the node at nodePath
        const target = findNodeByPath(tree, nodePath);
        if (!target) return res.status(400).json({ error: 'Target path not found' });
        if (target.spouse) return res.status(400).json({ error: 'Spouse already exists' });
        target.spouse = { name: node.name };
    } else if (relation === 'parent') {
        // add a parent above the node at nodePath
        const newParent = { name: node.name, children: [] };
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
            tree.children.push({ name: node.name, children: [] });
        } else {
            const parent = findNodeByPath(tree, nodePath);
            if (!parent) return res.status(400).json({ error: 'Parent path not found' });
            parent.children = parent.children || [];
            parent.children.push({ name: node.name, children: [] });
        }
    }

    if (!writeTree(tree)) return res.status(500).json({ error: 'Could not write tree data' });
    res.json(readTree());
});

// PUT update a node's name. Body: { path: [indices], name, relation }
router.put('/update', (req, res) => {
    const { path: nodePath = [], name, relation = 'self' } = req.body;
    if (typeof name !== 'string' || name.trim() === '') return res.status(400).json({ error: 'Valid name required' });

    const tree = readTree();
    if (!tree) return res.status(500).json({ error: 'Could not read tree data' });

    if (relation === 'spouse') {
        const target = findNodeByPath(tree, nodePath);
        if (!target || !target.spouse) return res.status(400).json({ error: 'Spouse not found' });
        target.spouse.name = name;
    } else if (relation === 'self') {
        const node = findNodeByPath(tree, nodePath);
        if (!node) return res.status(400).json({ error: 'Node path not found' });
        node.name = name;
    } else {
        return res.status(400).json({ error: 'Invalid relation for update' });
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