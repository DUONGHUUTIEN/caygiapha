const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const dataFile = path.join(__dirname, '..', 'data', 'family.json');

function readTree() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
  catch (e) { console.error('readTree error', e); return null; }
}

function writeTree(t) {
  try { fs.writeFileSync(dataFile, JSON.stringify(t, null, 2), 'utf8'); return true; }
  catch (e) { console.error('writeTree error', e); return false; }
}

function findNodeByPath(root, pathArr) {
  let node = root;
  for (let idx of pathArr) {
    if (!node.children || !node.children[idx]) return null;
    node = node.children[idx];
  }
  return node;
}

function traverse(root) {
  const out = [];
  function dfs(node, path, depth) {
    out.push({ name: node.name || '', path: path.slice(), generation: depth, node });
    if (node.spouse) out.push({ name: node.spouse.name || '', path: path.slice(), generation: depth, relation: 'spouse', node: node.spouse });
    if (node.children) node.children.forEach((c, i) => dfs(c, path.concat(i), depth + 1));
  }
  dfs(root, [], 1);
  return out;
}

// GET flat list
router.get('/list', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const tree = readTree(); if (!tree) return res.status(500).json({ error: 'no data' });
  const list = traverse(tree).map(it => ({ name: it.name, path: it.path, generation: it.generation, relation: it.relation || 'self', node: it.node, childrenCount: (it.node && it.node.children) ? it.node.children.length : 0 }));
  const filtered = q ? list.filter(i => i.name.toLowerCase().includes(q)) : list;
  res.json(filtered);
});

// GET search (supports same filters as before)
router.get('/search', (req, res) => {
  const { name = '', gender = '', gen = '', fromYear, toYear, occupation = '' } = req.query;
  const tree = readTree(); if (!tree) return res.status(500).json({ error: 'no data' });
  const list = traverse(tree).map(m => ({ name: m.name, path: m.path, generation: m.generation, node: m.node }));
  const filtered = list.filter(it => {
    if (name && !it.name.toLowerCase().includes(name.toLowerCase())) return false;
    if (gen && Number(gen) && it.generation !== Number(gen)) return false;
    if (gender && it.node && it.node.gender && it.node.gender.toLowerCase() !== gender.toLowerCase()) return false;
    if (occupation && it.node && it.node.occupation && !it.node.occupation.toLowerCase().includes(occupation.toLowerCase())) return false;
    if (fromYear || toYear) {
      const year = it.node && it.node.dob ? new Date(it.node.dob).getFullYear() : null;
      if (fromYear && year && year < Number(fromYear)) return false;
      if (toYear && year && year > Number(toYear)) return false;
    }
    return true;
  });
  res.json(filtered);
});

// Add member
router.post('/', (req, res) => {
  const { name, gender, dob, birthplace, parentPath = [], relation = 'child', occupation = '', notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const tree = readTree(); if (!tree) return res.status(500).json({ error: 'no data' });
  const newNode = { name, gender, dob, birthplace, occupation, notes, children: [] };
  if (relation === 'spouse') {
    const target = parentPath.length === 0 ? tree : findNodeByPath(tree, parentPath);
    if (!target) return res.status(400).json({ error: 'target not found' });
    target.spouse = { name, gender, dob, birthplace, occupation, notes };
  } else if (relation === 'parent') {
    if (parentPath.length === 0) { newNode.children = [tree]; if (!writeTree(newNode)) return res.status(500).json({ error: 'write failed' }); return res.json({ ok: true }); }
    const parentContainer = parentPath.slice(0, -1).length === 0 ? tree : findNodeByPath(tree, parentPath.slice(0, -1));
    const idx = parentPath[parentPath.length - 1];
    if (!parentContainer || !parentContainer.children || !parentContainer.children[idx]) return res.status(400).json({ error: 'path not found' });
    const old = parentContainer.children[idx]; newNode.children = [old]; parentContainer.children.splice(idx, 1, newNode);
  } else {
    if (parentPath.length === 0) { tree.children = tree.children || []; tree.children.push(newNode); }
    else { const parent = findNodeByPath(tree, parentPath); if (!parent) return res.status(400).json({ error: 'parent not found' }); parent.children = parent.children || []; parent.children.push(newNode); }
  }
  if (!writeTree(tree)) return res.status(500).json({ error: 'write failed' }); res.json({ ok: true });
});

// Update member
router.put('/', (req, res) => {
  const { path = [], updates = {}, relation = 'self' } = req.body;
  if (!Array.isArray(path)) return res.status(400).json({ error: 'path required' });
  const tree = readTree(); if (!tree) return res.status(500).json({ error: 'no data' });
  if (relation === 'spouse') { const target = path.length === 0 ? tree : findNodeByPath(tree, path); if (!target || !target.spouse) return res.status(400).json({ error: 'spouse not found' }); Object.assign(target.spouse, updates); }
  else { const node = path.length === 0 ? tree : findNodeByPath(tree, path); if (!node) return res.status(400).json({ error: 'node not found' }); Object.assign(node, updates); }
  if (!writeTree(tree)) return res.status(500).json({ error: 'write failed' }); res.json({ ok: true });
});

// Delete member
router.delete('/', (req, res) => {
  const { path = [], relation = 'self' } = req.body; if (!Array.isArray(path) || path.length === 0) return res.status(400).json({ error: 'path required' });
  const tree = readTree(); if (!tree) return res.status(500).json({ error: 'no data' });
  if (relation === 'spouse') { const target = path.length === 0 ? tree : findNodeByPath(tree, path); if (!target || !target.spouse) return res.status(400).json({ error: 'spouse not found' }); delete target.spouse; }
  else { const parentPath = path.slice(0, -1); const idx = path[path.length - 1]; const parent = parentPath.length === 0 ? tree : findNodeByPath(tree, parentPath); if (!parent || !parent.children || parent.children.length <= idx) return res.status(400).json({ error: 'path not found' }); const removed = parent.children.splice(idx, 1)[0]; if (removed && removed.children && removed.children.length > 0) parent.children.splice(idx, 0, ...removed.children); }
  if (!writeTree(tree)) return res.status(500).json({ error: 'write failed' }); res.json({ ok: true });
});

// Detail: get member node + relations by path query param
router.get('/detail', (req, res) => {
  const pathStr = req.query.path;
  if (!pathStr) return res.status(400).json({ error: 'path required' });
  let pathArr;
  try { pathArr = JSON.parse(pathStr); if (!Array.isArray(pathArr)) throw new Error('bad'); } catch (e) { return res.status(400).json({ error: 'invalid path' }); }
  const tree = readTree(); if (!tree) return res.status(500).json({ error: 'no data' });
  const node = pathArr.length === 0 ? tree : findNodeByPath(tree, pathArr);
  if (!node) return res.status(404).json({ error: 'node not found' });
  const parentPath = pathArr.slice(0, -1);
  const parent = parentPath.length === 0 ? null : findNodeByPath(tree, parentPath);
  const spouse = node.spouse || null;
  const children = (node.children || []).map((c, i) => ({ name: c.name || '', path: pathArr.concat(i) }));
  res.json({ node, path: pathArr, parent: parent ? { name: parent.name, path: parentPath } : null, spouse: spouse ? { name: spouse.name } : null, children, events: node.events || [] });
});

module.exports = router;
