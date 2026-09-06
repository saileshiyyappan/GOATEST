import { RawSensorPacket } from '../../types/shb';

export interface ParsedSensorData {
  isValid: boolean;
  timestamp: number;
  packetType: 'VITAL' | 'STATUS' | 'BFIT' | 'PROGRESS' | 'EMERGENCY' | 'ERROR' | 'GENERIC';
  // Direct physiological metrics
  heartRate: number | null;
  spO2: number | null;
  ppi: number | null;
  skinTemp: number | null;
  // Raw optical & electrical
  ir: number | null;
  red: number | null;
  ecg: number | null;
  // Environmental & Kinematic Context
  ambientTemp: number | null;
  humidity: number | null;
  pressure: number | null;
  altitude: number | null;
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  motionMagnitude: number | null;
  // Safety & Event Controls
  shake: number | null;
  fall: number | null;
  batteryPercent: number | null;
  bfitScore: number | null;
  rawString: string;
  parseErrors: string[];
  fieldsFound: string[];
}

/**
 * Parses standard Bluetooth GATT Heart Rate Measurement Characteristic (UUID 0x2A37)
 * Specs: https://www.bluetooth.com/specifications/specs/heart-rate-service/
 */
export function parseGattHeartRateData(dataView: DataView): ParsedSensorData {
  const timestamp = Date.now();
  const flags = dataView.getUint8(0);
  const is16BitHr = (flags & 0x01) !== 0;
  const sensorContactSupported = (flags & 0x04) !== 0;
  const sensorContactDetected = (flags & 0x02) !== 0;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrIntervalsPresent = (flags & 0x10) !== 0;

  let offset = 1;
  let heartRate: number | null = null;

  if (is16BitHr && dataView.byteLength >= offset + 2) {
    heartRate = dataView.getUint16(offset, true); // Little-endian
    offset += 2;
  } else if (!is16BitHr && dataView.byteLength >= offset + 1) {
    heartRate = dataView.getUint8(offset);
    offset += 1;
  }

  if (energyExpendedPresent && dataView.byteLength >= offset + 2) {
    offset += 2;
  }

  let ppi: number | null = null;
  if (rrIntervalsPresent && dataView.byteLength >= offset + 2) {
    const rawRr = dataView.getUint16(offset, true);
    // Convert 1/1024s to ms: (rawRr * 1000) / 1024
    const rrMs = Math.round((rawRr * 1000) / 1024);
    if (rrMs >= 250 && rrMs <= 2000) {
      ppi = rrMs;
    } else if (rawRr >= 250 && rawRr <= 2000) {
      ppi = rawRr;
    }
  }

  if (!ppi && heartRate && heartRate >= 30 && heartRate <= 240) {
    ppi = Math.round(60000 / heartRate);
  }

  const isValid = heartRate !== null && heartRate >= 30 && heartRate <= 240;
  const fieldsFound: string[] = [];
  if (heartRate !== null) fieldsFound.push(`HR=${heartRate}`);
  if (ppi !== null) fieldsFound.push(`PPI=${ppi}`);

  return {
    isValid,
    timestamp,
    packetType: 'VITAL',
    heartRate: isValid ? heartRate : null,
    spO2: null,
    ppi,
    skinTemp: null,
    ir: sensorContactDetected ? 10000 : 0,
    red: null,
    ecg: null,
    ambientTemp: null,
    humidity: null,
    pressure: null,
    altitude: null,
    accelX: null,
    accelY: null,
    accelZ: null,
    motionMagnitude: null,
    shake: null,
    fall: null,
    batteryPercent: null,
    bfitScore: null,
    rawString: `[GATT 0x2A37 HR=${heartRate} Flags=0x${flags.toString(16)}]`,
    parseErrors: isValid ? [] : ['HR value outside physiological bounds (30-240 bpm)'],
    fieldsFound,
  };
}

/**
 * Universal Parser for M-BAND telemetry packets
 * Matches M-BAND firmware BLEPackets output:
 * 1. BLEPackets::vital(...) -> VITAL:HR=72,SPO2=98,TEMP=36.5,PPI=833,AX=0.01,AY=-9.81,AZ=0.02,PRES=101325,ALT=106.4,HUM=94.0
 * 2. Positional VITAL: VITAL,72,98,36.5,833,-0.08,-9.81,-0.57
 * 3. JSON formatted payloads: {"type":"vital","hr":72,"spo2":98,"temp":36.5,"ppi":833}
 * 4. BLEPackets::status(...) -> STATUS:BAT=95,STATE=READY
 * 5. BLEPackets::bfitScore(...) -> BFIT:SCORE=85,STATUS=ALLOW
 * 6. BLEPackets::shbProgress(...) -> PROGRESS:ELAPSED=15,TOTAL=65
 * 7. Key-Value pairs without prefix
 * 8. Binary GATT packets
 */
export function parseSensorPacket(raw: string | RawSensorPacket | DataView | ArrayBuffer): ParsedSensorData {
  const timestamp = Date.now();
  const parseErrors: string[] = [];
  const fieldsFound: string[] = [];

  // Handle DataView / ArrayBuffer directly
  if (raw instanceof DataView) {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(raw);
      if (text && (text.includes('=') || text.includes('{') || text.includes(':') || text.includes(','))) {
        return parseSensorPacket(text);
      }
    } catch {
      // Not text, proceed to binary parsing
    }
    return parseGattHeartRateData(raw);
  }

  if (raw instanceof ArrayBuffer) {
    return parseSensorPacket(new DataView(raw));
  }

  // Handle Object structure
  if (typeof raw !== 'string') {
    const p = raw;
    const hr = typeof p.hr === 'number' && p.hr >= 30 && p.hr <= 240 ? Math.round(p.hr) : null;
    const spo2 = typeof p.spo2 === 'number' && p.spo2 >= 70 && p.spo2 <= 100 ? Math.round(p.spo2) : null;
    const ppi = typeof p.ppi === 'number' && p.ppi >= 250 && p.ppi <= 2000 
      ? Math.round(p.ppi) 
      : (hr ? Math.round(60000 / hr) : null);
    const temp = typeof p.temp === 'number' && p.temp >= 15 && p.temp <= 45 ? parseFloat(p.temp.toFixed(1)) : null;

    let motionMag: number | null = null;
    if (typeof p.ax === 'number' && typeof p.ay === 'number' && typeof p.az === 'number') {
      const rawMag = Math.sqrt(p.ax * p.ax + p.ay * p.ay + p.az * p.az);
      let dynG: number;
      if (rawMag > 4.0) {
        // Raw magnitude in m/s^2 (gravity = 9.81 m/s^2) -> convert dynamic motion vector to g
        dynG = Math.abs(rawMag - 9.81) / 9.81;
      } else {
        // Raw magnitude in normalized g (gravity = 1.0 g) -> dynamic deviation from 1g
        dynG = Math.abs(rawMag - 1.0);
      }
      motionMag = parseFloat(dynG.toFixed(2));
    }

    const shakeVal = typeof p.shake === 'number' ? (p.shake === 1 ? 1 : p.shake === 0 ? 0 : Math.round(p.shake)) : null;
    const fallVal = typeof p.fall === 'number' ? (p.fall === 1 ? 1 : p.fall === 0 ? 0 : Math.round(p.fall)) : null;

    if (hr !== null) fieldsFound.push(`HR=${hr}`);
    if (spo2 !== null) fieldsFound.push(`SpO2=${spo2}`);
    if (ppi !== null) fieldsFound.push(`PPI=${ppi}`);
    if (temp !== null) fieldsFound.push(`TEMP=${temp}`);
    if (motionMag !== null) fieldsFound.push(`MOTION=${motionMag}`);
    if (shakeVal !== null) fieldsFound.push(`SHAKE=${shakeVal}`);
    if (fallVal !== null) fieldsFound.push(`FALL=${fallVal}`);

    const isValid = hr !== null || spo2 !== null || temp !== null || p.pres !== undefined || motionMag !== null || shakeVal !== null;

    return {
      isValid,
      timestamp: p.timestamp || timestamp,
      packetType: 'VITAL',
      heartRate: hr,
      spO2: spo2,
      ppi,
      skinTemp: temp,
      ir: typeof p.ir === 'number' ? p.ir : null,
      red: typeof p.red === 'number' ? p.red : null,
      ecg: typeof p.ecg === 'number' ? p.ecg : null,
      ambientTemp: typeof p.temp === 'number' ? p.temp : null,
      humidity: typeof p.hum === 'number' ? p.hum : null,
      pressure: typeof p.pres === 'number' ? p.pres : null,
      altitude: typeof p.alt === 'number' ? p.alt : null,
      accelX: typeof p.ax === 'number' ? p.ax : null,
      accelY: typeof p.ay === 'number' ? p.ay : null,
      accelZ: typeof p.az === 'number' ? p.az : null,
      motionMagnitude: motionMag,
      shake: shakeVal,
      fall: fallVal,
      batteryPercent: typeof (p as any).bat === 'number' ? (p as any).bat : null,
      bfitScore: typeof (p as any).bfit === 'number' ? (p as any).bfit : null,
      rawString: p.rawString || JSON.stringify(p),
      parseErrors,
      fieldsFound,
    };
  }

  const rawTrimmed = raw.trim();
  if (!rawTrimmed) {
    return {
      isValid: false,
      timestamp,
      packetType: 'GENERIC',
      heartRate: null,
      spO2: null,
      ppi: null,
      skinTemp: null,
      ir: null,
      red: null,
      ecg: null,
      ambientTemp: null,
      humidity: null,
      pressure: null,
      altitude: null,
      accelX: null,
      accelY: null,
      accelZ: null,
      motionMagnitude: null,
      shake: null,
      fall: null,
      batteryPercent: null,
      bfitScore: null,
      rawString: raw,
      parseErrors: ['Empty packet received'],
      fieldsFound: [],
    };
  }

  let packetType: ParsedSensorData['packetType'] = 'VITAL';
  let cleanPayload = rawTrimmed;

  // Extract M-BAND BLEPackets header prefixes (e.g. "VITAL:...", "STATUS:...", "BFIT:...", "PROGRESS:...")
  const prefixMatch = cleanPayload.match(/^([A-Za-z0-9_]+):(.*)$/s);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    if (prefix === 'VITAL') packetType = 'VITAL';
    else if (prefix === 'STATUS') packetType = 'STATUS';
    else if (prefix === 'BFIT') packetType = 'BFIT';
    else if (prefix === 'PROGRESS') packetType = 'PROGRESS';
    else if (prefix === 'EMERGENCY') packetType = 'EMERGENCY';
    else if (prefix === 'ERROR') packetType = 'ERROR';
    cleanPayload = prefixMatch[2].trim();
  }

  const map: Record<string, number> = {};

  // Case 1: JSON payload
  if (cleanPayload.startsWith('{') && cleanPayload.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(cleanPayload);
      if (parsedJson.type) {
        const t = String(parsedJson.type).toUpperCase();
        if (t.includes('VITAL')) packetType = 'VITAL';
        else if (t.includes('STATUS')) packetType = 'STATUS';
        else if (t.includes('BFIT')) packetType = 'BFIT';
      }
      for (const [k, v] of Object.entries(parsedJson)) {
        const num = typeof v === 'number' ? v : parseFloat(String(v));
        if (!isNaN(num)) {
          map[k.trim().toUpperCase()] = num;
        }
      }
    } catch (e: any) {
      parseErrors.push(`JSON parse error: ${e.message}`);
    }
  } else if (/^(?:VITAL,)?[+-]?\d+(?:\.\d+)?,[+-]?\d+(?:\.\d+)?,[+-]?\d+/.test(cleanPayload)) {
    // Case 2: Positional CSV (e.g. "VITAL,72,98,36.5,833,0.01,-9.81,0.02") or ("72,98,36.5,833,0.01,-9.81,0.02")
    const parts = cleanPayload.split(',');
    let offset = 0;
    if (isNaN(Number(parts[0]))) {
      const tag = parts[0].toUpperCase();
      if (tag === 'VITAL') packetType = 'VITAL';
      offset = 1;
    }
    const hrVal = parseFloat(parts[offset]);
    const spo2Val = parseFloat(parts[offset + 1]);
    const tempVal = parseFloat(parts[offset + 2]);
    const ppiVal = parseFloat(parts[offset + 3]);
    const axVal = parseFloat(parts[offset + 4]);
    const ayVal = parseFloat(parts[offset + 5]);
    const azVal = parseFloat(parts[offset + 6]);

    if (!isNaN(hrVal)) map['HR'] = hrVal;
    if (!isNaN(spo2Val)) map['SPO2'] = spo2Val;
    if (!isNaN(tempVal)) map['TEMP'] = tempVal;
    if (!isNaN(ppiVal)) map['PPI'] = ppiVal;
    if (!isNaN(axVal)) map['AX'] = axVal;
    if (!isNaN(ayVal)) map['AY'] = ayVal;
    if (!isNaN(azVal)) map['AZ'] = azVal;
  } else {
    // Case 3: Delimited Key-Value string (commas, semicolons, newlines, spaces)
    const cleanStr = cleanPayload.replace(/[\r\n]+/g, ',');
    const tokens = cleanStr.split(/[,;\t]+/);

    for (const token of tokens) {
      if (!token.trim()) continue;
      // Match KEY=VAL or KEY:VAL or KEY VAL
      const match = token.match(/^([A-Za-z0-9_]+)[:=\s]+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)$/);
      if (match) {
        const key = match[1].toUpperCase().trim();
        const val = parseFloat(match[2]);
        if (!isNaN(val)) {
          map[key] = val;
        }
      } else {
        const [k, v] = token.split(/[:=]/);
        if (k && v !== undefined) {
          const num = parseFloat(v.trim());
          if (!isNaN(num)) {
            map[k.trim().toUpperCase()] = num;
          }
        }
      }
    }
  }

  // Map key aliases
  const rawHr = map['HR'] ?? map['HEARTRATE'] ?? map['HEART_RATE'] ?? map['BPM'] ?? map['PULSE'];
  const rawSpo2 = map['SPO2'] ?? map['O2'] ?? map['OXYGEN'] ?? map['SAT'];
  const rawPpi = map['PPI'] ?? map['RR'] ?? map['IBI'] ?? map['INTERVAL'];
  const rawTemp = map['TEMP'] ?? map['SKINTEMP'] ?? map['TEMPERATURE'] ?? map['T'];
  const rawPres = map['PRES'] ?? map['PRESSURE'] ?? map['P'] ?? map['BARO'] ?? map['ATM_PRES'] ?? map['ATM_PRESSURE'] ?? map['ATMOSPHERIC_PRESSURE'];
  const rawAlt = map['ALT'] ?? map['ALTITUDE'];
  const rawHum = map['HUM'] ?? map['HUMIDITY'] ?? map['H'];
  const rawAx = map['AX'] ?? map['ACCEL_X'] ?? map['ACCX'];
  const rawAy = map['AY'] ?? map['ACCEL_Y'] ?? map['ACCY'];
  const rawAz = map['AZ'] ?? map['ACCEL_Z'] ?? map['ACCZ'];
  const rawIr = map['IR'] ?? map['OPTICAL_IR'] ?? map['RAW_IR'];
  const rawRed = map['RED'] ?? map['OPTICAL_RED'] ?? map['RAW_RED'];
  const rawEcg = map['ECG'];
  const rawBat = map['BAT'] ?? map['BATTERY'] ?? map['BATT'];
  const rawBfit = map['BFIT'] ?? map['SCORE'] ?? map['BFIT_SCORE'];
  const rawShake = map['SHAKE'] ?? map['SHAKE_EVENT'] ?? map['SHK'];
  const rawFall = map['FALL'] ?? map['FALL_EVENT'] ?? map['FLL'];

  // Physiological boundaries & validation
  let hr: number | null = null;
  if (rawHr !== undefined) {
    if (rawHr >= 30 && rawHr <= 240) {
      hr = Math.round(rawHr);
      fieldsFound.push(`HR=${hr}`);
    } else if (rawHr !== 0) {
      parseErrors.push(`HR=${rawHr} out of physiological bounds (30-240 bpm)`);
    }
  }

  let spo2: number | null = null;
  if (rawSpo2 !== undefined) {
    if (rawSpo2 >= 70 && rawSpo2 <= 100) {
      spo2 = Math.round(rawSpo2);
      fieldsFound.push(`SpO2=${spo2}`);
    } else if (rawSpo2 !== 0) {
      parseErrors.push(`SpO2=${rawSpo2} out of physiological bounds (70-100%)`);
    }
  }

  let ppi: number | null = null;
  if (rawPpi !== undefined && rawPpi >= 250 && rawPpi <= 2000) {
    ppi = Math.round(rawPpi);
    fieldsFound.push(`PPI=${ppi}`);
  } else if (hr) {
    ppi = Math.round(60000 / hr);
    fieldsFound.push(`PPI=${ppi} (est)`);
  }

  let skinTemp: number | null = null;
  if (rawTemp !== undefined) {
    if (rawTemp >= 15 && rawTemp <= 45) {
      skinTemp = parseFloat(rawTemp.toFixed(1));
      fieldsFound.push(`TEMP=${skinTemp}°C`);
    } else {
      parseErrors.push(`TEMP=${rawTemp} out of physical bounds (15-45°C)`);
    }
  }

  let motionMag: number | null = null;
  if (rawAx !== undefined && rawAy !== undefined && rawAz !== undefined) {
    const rawMag = Math.sqrt(rawAx * rawAx + rawAy * rawAy + rawAz * rawAz);
    let dynG: number;
    if (rawMag > 4.0) {
      // Raw magnitude in m/s^2 (gravity = 9.81 m/s^2) -> convert dynamic motion vector to g
      dynG = Math.abs(rawMag - 9.81) / 9.81;
    } else {
      // Raw magnitude in normalized g (gravity = 1.0 g) -> dynamic deviation from 1g
      dynG = Math.abs(rawMag - 1.0);
    }
    motionMag = parseFloat(dynG.toFixed(2));
    fieldsFound.push(`MOTION=${motionMag}g`);
  }

  let presVal: number | null = null;
  if (rawPres !== undefined && !isNaN(rawPres) && rawPres > 0) {
    // If in Pascals (e.g. 100056 Pa), convert to hPa (1000.6 hPa)
    presVal = rawPres > 2000 ? parseFloat((rawPres / 100).toFixed(1)) : parseFloat(rawPres.toFixed(1));
    fieldsFound.push(`PRES=${presVal}hPa`);
  }

  let shakeVal: number | null = null;
  if (rawShake !== undefined) {
    shakeVal = rawShake === 1 ? 1 : rawShake === 0 ? 0 : Math.round(rawShake);
    fieldsFound.push(`SHAKE=${shakeVal}`);
  }

  let fallVal: number | null = null;
  if (rawFall !== undefined) {
    fallVal = rawFall === 1 ? 1 : rawFall === 0 ? 0 : Math.round(rawFall);
    fieldsFound.push(`FALL=${fallVal}`);
  }

  if (rawBat !== undefined && rawBat >= 0 && rawBat <= 100) {
    fieldsFound.push(`BAT=${rawBat}%`);
  }

  if (rawBfit !== undefined) {
    fieldsFound.push(`BFIT=${rawBfit}`);
  }

  const hasAnyValidField =
    hr !== null ||
    spo2 !== null ||
    skinTemp !== null ||
    motionMag !== null ||
    shakeVal !== null ||
    rawPres !== undefined ||
    rawBat !== undefined ||
    rawBfit !== undefined;

  if (!hasAnyValidField && parseErrors.length === 0) {
    parseErrors.push('No recognized sensor metrics in packet');
  }

  return {
    isValid: hasAnyValidField,
    timestamp,
    packetType,
    heartRate: hr,
    spO2: spo2,
    ppi,
    skinTemp,
    ir: rawIr !== undefined ? rawIr : null,
    red: rawRed !== undefined ? rawRed : null,
    ecg: rawEcg !== undefined ? rawEcg : null,
    ambientTemp: rawTemp !== undefined ? rawTemp : null,
    humidity: rawHum !== undefined ? rawHum : null,
    pressure: presVal,
    altitude: rawAlt !== undefined ? rawAlt : null,
    accelX: rawAx !== undefined ? rawAx : null,
    accelY: rawAy !== undefined ? rawAy : null,
    accelZ: rawAz !== undefined ? rawAz : null,
    motionMagnitude: motionMag,
    shake: shakeVal,
    fall: fallVal,
    batteryPercent: rawBat !== undefined && rawBat >= 0 && rawBat <= 100 ? Math.round(rawBat) : null,
    bfitScore: rawBfit !== undefined ? Math.round(rawBfit) : null,
    rawString: raw,
    parseErrors,
    fieldsFound,
  };
}
