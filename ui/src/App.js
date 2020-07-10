import React from 'react';
import logo from './logo.svg';
import './App.css';

function Create() {
  return (
    <>
    <div>Add to Pegasus</div>
    <div><button>Create Peg</button> on <select><option>Agoric</option></select></div>
    </>
  );
}

const knownTitleArea = { gridArea: '1 / 1 / 2 / 2'}
function Known() {
  return (
    <div style={{gridArea: }}>
    <div className="known-title">Known to You</div> 
    <div className="known-name">Name</div> <div className="known-uri">URI</div>
    <div className="known-name row-">Gaia $ATOM</div> <div>ics20-1:portabc/chandef/uatom</div>
    </div>
  )
}

function Gossip() {
  return (
    <div className="Gossip">
      <div>0x9383</div><div>claims to be</div><div>Gaia $ATOM</div><div>ics20-1:portdef/chanfoo/uatom</div>
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <Known/>
      <Create/>
      <div>Caution: Gossip</div> <Gossip/>
    </div>
  );
}

export default App;
