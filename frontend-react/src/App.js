import { useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import _ from 'lodash';
import * as React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import MenuIcon from '@mui/icons-material/Menu';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';

import Axios from 'axios';

// MAP
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import GpxParser from 'gpxparser';
import grupo6_default from "./trail_route.gpx";
import grupo6_madeira_crossing from "./madeira_crossing.gpx";
import grupo6_pr9 from "./pr9_madeira.gpx";
import grupo6_pr13 from "./pr13_madeira.gpx";

const startIcon = new L.Icon({
    iconUrl: 'start.png',
    iconSize: new L.Point(32, 32)
});

const endIcon = new L.Icon({
    iconUrl: 'finish.png',
    iconSize: new L.Point(32, 32)
});

const maleIcon = L.icon({
  iconUrl: "male.png",
  iconSize: new L.Point(32, 32)
});

const femaleIcon = L.icon({
  iconUrl: "female.png",
  iconSize: new L.Point(32, 32)
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: (theme.vars ?? theme).palette.text.secondary,
  ...theme.applyStyles('dark', {
    backgroundColor: '#1A2027',
  }),
}));

let websocket;

export default function App() {
  // Initializers
  const [trailLine, setTrailLine] = React.useState([]);
  const [trail, setTrail] = React.useState('grupo6_default');
  const [athlete, setAthlete] = React.useState('all');
  const [athleteMarkers, setAthleteMarkers] = React.useState({});
  const [websocket, setWebsocket] = React.useState();
  const [socketId, setSocketId] = React.useState();

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      connect();
    }
  }, [])

  useEffect(() => {
    console.log('Trail Changed');
    loadTrailLines(trail);
    setAthleteMarkers({})
    connect();
  }, [trail])

  useEffect(() => {
    console.log('Athlete Changed');
    setAthleteMarkers({})
    connect();
  }, [athlete])

  useEffect(() => {
    if (websocket) {
      websocket.onmessage = (event) => {
        const jsonData = JSON.parse(event.data);
        const athlete = jsonData.athlete;
        const upMarkers = athleteMarkers;
        upMarkers[athlete] = jsonData;
        setAthleteMarkers({ ...upMarkers })
      };
    }
  }, [websocket])
  
  const connect = () => {
    console.log('connect');
    if (websocket) { websocket.close() }
    setWebsocket(new WebSocket(`ws://localhost:30016/?trail=${trail}&athlete=${athlete}`));
  }

  const loadTrailLines = (trail) => {
    let fileToLoad
    switch (trail) {
      case 'grupo6_default':
        fileToLoad = grupo6_default;
        break;
      case 'grupo6_madeira_crossing':
        fileToLoad = grupo6_madeira_crossing;
        break;
      case 'grupo6_pr9':
        fileToLoad = grupo6_pr9;
        break;
      case 'grupo6_pr13':
        fileToLoad = grupo6_pr13;
        break;
      default:
        fileToLoad = grupo6_default;
    }
    Axios.get(fileToLoad, {
      "Content-Type": "application/xml; charset=utf-8"
    })
    .then((response) => {
      const gpx = new GpxParser();
      gpx.parse(response.data);
      const positions = gpx.tracks[0].points.map(p => [p.lat, p.lon]);
      setTrailLine(positions);
    });
  }

  // Handlers
  const handleTrailChange = (event) => {
    setTrail(event.target.value);
  };

  const handleAthleteChange = (event) => {
    setAthlete(event.target.value);
  };

  // Map
  const mapRef = useRef(null);

  // Render
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="open drawer"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            Madeira Trail Tracker
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <FormControl sx={{ minWidth: 300 }} padding={10}>
            <InputLabel id="demo-simple-select-label">Trail</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={trail}
              label="Trail"
              onChange={handleTrailChange}
            >
              <MenuItem value="grupo6_default">Default</MenuItem>
              <MenuItem value="grupo6_madeira_crossing">Madeira Crossing</MenuItem>
              <MenuItem value="grupo6_pr9">PR9 - Levada do Caldeirão Verde</MenuItem>
              <MenuItem value="grupo6_pr13">PR13 - Vereda do Fanal</MenuItem>
            </Select>
            </FormControl>
            <Box sx={{ flexGrow: 1 }} />
            <FormControl sx={{ minWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">Athetes</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={athlete}
              label="Athlete"
              onChange={handleAthleteChange}
            >
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
          
          <Box sx={{ flexGrow: 1 }} />

        </Toolbar>
      </AppBar>
    </Box>

    <Grid container spacing={2} padding={2}>
      <Grid size={12}>
        <Item>
          
        <MapContainer center={[32.7356, -16.9289]} zoom={11} ref={mapRef} style={{height: "90vh", width: "100%"}}>
          <TileLayer
            attribution='<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
          <Polyline
            pathOptions={{ fillColor: 'red', color: 'blue' }}
            positions={trailLine}
          />
          { !_.isEmpty(trailLine) &&
            <Marker position={trailLine[0]} icon={startIcon}></Marker>
          }

          { !_.isEmpty(trailLine) &&
            <Marker position={trailLine[_.size(trailLine)-1]} icon={endIcon}></Marker>
          }

          { _.map(athleteMarkers, (markerData, x) => {
            return <Marker key={x} position={[markerData.location.latitude, markerData.location.longitude]} icon={_.isEqual(markerData.gender, 'male') ? maleIcon : femaleIcon }><Popup>{x}</Popup></Marker>
          })};
          
      </MapContainer>
        </Item>
      </Grid>
    </Grid>
    
    </ThemeProvider>
  );
}