const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const dataFile = path.join(__dirname, '..', 'data', 'events.json');

function readEvents(){
  try { return JSON.parse(fs.readFileSync(dataFile,'utf8')); } catch(e){ return []; }
}

function writeEvents(list){
  try { fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8'); return true; } catch(e){ console.error(e); return false; }
}

// list events
router.get('/list', (req,res)=>{
  const events = readEvents();
  res.json(events);
});

// get by id
router.get('/:id', (req,res)=>{
  const events = readEvents();
  const e = events.find(x=> x.id == req.params.id);
  if(!e) return res.status(404).json({ error: 'not found' });
  res.json(e);
});

// add
router.post('/', (req,res)=>{
  const { title, type='other', importance='normal', date, time, place='', mainMember=null, participants=[], description='', notes='', remind='' } = req.body;
  if(!title || !date) return res.status(400).json({ error:'title and date required' });
  const events = readEvents();
  const id = Date.now();
  const ev = { id, title, type, importance, date, time, place, mainMember, participants, description, notes, remind };
  events.push(ev); if(!writeEvents(events)) return res.status(500).json({ error:'write failed' });
  res.json(ev);
});

// update
router.put('/:id', (req,res)=>{
  const events = readEvents();
  const idx = events.findIndex(x=> x.id == req.params.id);
  if(idx === -1) return res.status(404).json({ error:'not found' });
  Object.assign(events[idx], req.body);
  if(!writeEvents(events)) return res.status(500).json({ error:'write failed' });
  res.json(events[idx]);
});

// delete
router.delete('/:id', (req,res)=>{
  let events = readEvents();
  const idx = events.findIndex(x=> x.id == req.params.id);
  if(idx === -1) return res.status(404).json({ error:'not found' });
  const removed = events.splice(idx,1)[0];
  if(!writeEvents(events)) return res.status(500).json({ error:'write failed' });
  res.json(removed);
});

module.exports = router;
