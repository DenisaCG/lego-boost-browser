import { Hub } from './hub';
import { Motor } from '../types'

const CALLBACK_TIMEOUT_MS = 1000 / 3;

export const DEFAULT_CONFIG = {
  METRIC_MODIFIER: 28.5,
  TURN_MODIFIER: 2.56,
  DRIVE_SPEED: 25,
  TURN_SPEED: 20,
  DEFAULT_STOP_DISTANCE: 105,
  DEFAULT_CLEAR_DISTANCE: 120,
  LEFT_MOTOR: 'A' as Motor,
  RIGHT_MOTOR: 'B' as Motor,
  VALID_MOTORS: ['A' as Motor, 'B' as Motor],
};

const validateConfiguration = (configuration: BoostConfiguration) => {
  configuration.leftMotor = configuration.leftMotor || DEFAULT_CONFIG.LEFT_MOTOR;
  configuration.rightMotor = configuration.rightMotor || DEFAULT_CONFIG.RIGHT_MOTOR;

  // @ts-ignore
  if (!DEFAULT_CONFIG.VALID_MOTORS.includes(configuration.leftMotor)) throw Error('Define left port port correctly');

  // @ts-ignore
  if (!DEFAULT_CONFIG.VALID_MOTORS.includes(configuration.rightMotor)) throw Error('Define right port port correctly');

  if (configuration.leftMotor === configuration.rightMotor) throw Error('Left and right motor can not be same');

  configuration.distanceModifier = configuration.distanceModifier || DEFAULT_CONFIG.METRIC_MODIFIER;
  configuration.turnModifier = configuration.turnModifier || DEFAULT_CONFIG.TURN_MODIFIER;
  configuration.driveSpeed = configuration.driveSpeed || DEFAULT_CONFIG.DRIVE_SPEED;
  configuration.turnSpeed = configuration.turnSpeed || DEFAULT_CONFIG.TURN_SPEED;
  configuration.defaultStopDistance = configuration.defaultStopDistance || DEFAULT_CONFIG.DEFAULT_STOP_DISTANCE;
  configuration.defaultClearDistance = configuration.defaultClearDistance || DEFAULT_CONFIG.DEFAULT_CLEAR_DISTANCE;
};

const waitForValueToSet = function(
  valueName,
  compareFunc = valueNameToCompare => this[valueNameToCompare],
  timeoutMs = 0
) {
  if (compareFunc.bind(this)(valueName)) return Promise.resolve(this[valueName]);

  return new Promise((resolve, reject) => {
    setTimeout(
      async () => resolve(await waitForValueToSet.bind(this)(valueName, compareFunc, timeoutMs)),
      timeoutMs + 100
    );
  });
};

export interface BoostConfiguration {
  distanceModifier?: any;
  turnModifier?: any;
  defaultClearDistance?: any;
  defaultStopDistance?: any;
  leftMotor?: Motor;
  rightMotor?: Motor;
  driveSpeed?: number;
  turnSpeed?: number;
}

export class HubAsync extends Hub {
  hubDisconnected: boolean;
  configuration: BoostConfiguration;
  portData: any;
  useMetric: boolean;
  modifier: number;
  distance: number;

  constructor(bluetooth: BluetoothRemoteGATTCharacteristic, configuration: BoostConfiguration) {
    super(bluetooth);
    validateConfiguration(configuration);
    this.configuration = configuration;
    // added fix for error: Cannot read properties of undefined (reading 'AB’);
    this.afterInitialization();
  }
  /**
   * Disconnect Hub
   * @method Hub#disconnectAsync
   * @returns {Promise<boolean>} disconnection successful
   */
  disconnectAsync(): Promise<boolean> {
    this.setDisconnected();
    return waitForValueToSet.bind(this)('hubDisconnected');
  }

  /**
   * Execute this method after new instance of Hub is created
   * @method Hub#afterInitialization
   */
  afterInitialization() {
    this.hubDisconnected = null;
    this.portData = {
      A: { angle: 0 },
      B: { angle: 0 },
      AB: { angle: 0 },
      C: { angle: 0 },
      D: { angle: 0 },
      LED: { angle: 0 },
    };
    this.useMetric = true;
    this.modifier = 1;

    this.emitter.on('rotation', rotation => (this.portData[rotation.port].angle = rotation.angle));
    this.emitter.on('disconnect', () => (this.hubDisconnected = true));
    this.emitter.on('distance', distance => (this.distance = distance));
  }

  /**
   * Control the LED on the Move Hub
   * @method Hub#ledAsync
   * @param {boolean|number|string} color
   * If set to boolean `false` the LED is switched off, if set to `true` the LED will be white.
   * Possible string values: `off`, `pink`, `purple`, `blue`, `lightblue`, `cyan`, `green`, `yellow`, `orange`, `red`,
   * `white`
   * @returns {Promise}
   */
  ledAsync(color: boolean | number | string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.led(color, () => {
        // Callback is executed when command is sent and it will take some time before MoveHub executes the command
        setTimeout(resolve, CALLBACK_TIMEOUT_MS);
      });
    });
  }

  /**
   * Run a motor for specific time
   * @method Hub#motorTimeAsync
   * @param {string|number} port possible string values: `A`, `B`, `AB`, `C`, `D`.
   * @param {number} seconds
   * @param {number} [dutyCycle=100] motor power percentsage from `-100` to `100`. If a negative value is given rotation
   * is counterclockwise.
   * @param {boolean} [wait=false] will promise wait unitll motorTime run time has elapsed
   * @returns {Promise}
   */
  motorTimeAsync(port: string | number, seconds: number, dutyCycle: number = 100, wait: boolean = false): Promise<any> {
    return new Promise((resolve, _) => {
      this.motorTime(port, seconds, dutyCycle, () => {
        setTimeout(resolve, wait ? CALLBACK_TIMEOUT_MS + seconds * 1000 : CALLBACK_TIMEOUT_MS);
      });
    });
  }

  /**
   * Run both motors (A and B) for specific time
   * @method Hub#motorTimeMultiAsync
   * @param {number} seconds
   * @param {number} [dutyCycleA=100] motor power percentage from `-100` to `100`. If a negative value is given rotation
   * is counterclockwise.
   * @param {number} [dutyCycleB=100] motor power percentage from `-100` to `100`. If a negative value is given rotation
   * is counterclockwise.
   * @param {boolean} [wait=false] will promise wait unitll motorTime run time has elapsed
   * @returns {Promise}
   */
  motorTimeMultiAsync(seconds: number, dutyCycleA: number = 100, dutyCycleB: number = 100, wait: boolean = false): Promise<any> {
    return new Promise((resolve, _) => {
      this.motorTimeMulti(seconds, dutyCycleA, dutyCycleB, () => {
        setTimeout(resolve, wait ? CALLBACK_TIMEOUT_MS + seconds * 1000 : CALLBACK_TIMEOUT_MS);
      });
    });
  }

  /**
   * Turn a motor by specific angle
   * @method Hub#motorAngleAsync
   * @param {string|number} port possible string values: `A`, `B`, `AB`, `C`, `D`.
   * @param {number} angle - degrees to turn from `0` to `2147483647`
   * @param {number} [dutyCycle=100] motor power percentage from `-100` to `100`. If a negative value is given
   * rotation is counterclockwise.
   * @param {boolean} [wait=false] will promise wait unitll motorAngle has turned
   * @returns {Promise}
   */
  motorAngleAsync(port: string | number, angle: number, dutyCycle: number = 100, wait: boolean = false): Promise<any> {
    return new Promise((resolve, _) => {
      this.motorAngle(port, angle, dutyCycle, async () => {
        if (wait) {
          let beforeTurn;
          do {
            beforeTurn = this.portData[port].angle;
            await new Promise(res => setTimeout(res, CALLBACK_TIMEOUT_MS));
          } while (this.portData[port].angle !== beforeTurn);
          resolve();
        } else {
          setTimeout(resolve, CALLBACK_TIMEOUT_MS);
        }
      });
    });
  }

  /**
   * Turn both motors (A and B) by specific angle
   * @method Hub#motorAngleMultiAsync
   * @param {number} angle degrees to turn from `0` to `2147483647`
   * @param {number} [dutyCycleA=100] motor power percentage from `-100` to `100`. If a negative value is given
   * rotation is counterclockwise.
   * @param {number} [dutyCycleB=100] motor power percentage from `-100` to `100`. If a negative value is given
   * rotation is counterclockwise.
   * @param {boolean} [wait=false] will promise wait unitll motorAngle has turned
   * @returns {Promise}
   */
  motorAngleMultiAsync(angle: number, dutyCycleA: number = 100, dutyCycleB: number = 100, wait: boolean = false): Promise<any> {
    return new Promise((resolve, _) => {
      this.motorAngleMulti(angle, dutyCycleA, dutyCycleB, async () => {
        if (wait) {
          let beforeTurn;
          do {
            beforeTurn = this.portData['AB'].angle;
            await new Promise(res => setTimeout(res, CALLBACK_TIMEOUT_MS));
          } while (this.portData['AB'].angle !== beforeTurn);
          resolve();
        } else {
          setTimeout(resolve, CALLBACK_TIMEOUT_MS);
        }
      });
    });
  }

  /**
   * Use metric units (default)
   * @method Hub#useMetricUnits
   */
  useMetricUnits() {
    this.useMetric = true;
  }

  /**
   * Use imperial units
   * @method Hub#useImperialUnits
   */
  useImperialUnits() {
    this.useMetric = false;
  }

  /**
   * Set friction modifier
   * @method Hub#setFrictionModifier
   * @param {number} modifier friction modifier
   */
  setFrictionModifier(modifier: number) {
    this.modifier = modifier;
  }

  /**
   * Drive specified distance
   * @method Hub#drive
   * @param {number} distance distance in centimeters (default) or inches. Positive is forward and negative is backward.
   * @param {boolean} [wait=true] will promise wait untill the drive has completed.
   * @returns {Promise}
   */
  drive(distance: number, wait: boolean = true): Promise<any> {
    const angle =
      Math.abs(distance) *
      ((this.useMetric ? this.configuration.distanceModifier : this.configuration.distanceModifier / 4) *
        this.modifier);
    const dutyCycleA =
      this.configuration.driveSpeed * (distance > 0 ? 1 : -1) * (this.configuration.leftMotor === 'A' ? 1 : -1);
    const dutyCycleB =
      this.configuration.driveSpeed * (distance > 0 ? 1 : -1) * (this.configuration.leftMotor === 'A' ? 1 : -1);
    return this.motorAngleMultiAsync(angle, dutyCycleA, dutyCycleB, wait);
  }

  /**
   * Turn robot specified degrees
   * @method Hub#turn
   * @param {number} degrees degrees to turn. Negative is to the left and positive to the right.
   * @param {boolean} [wait=true] will promise wait untill the turn has completed.
   * @returns {Promise}
   */
  turn(degrees: number, wait: boolean = true): Promise<any> {
    const angle = Math.abs(degrees) * this.configuration.turnModifier;
    const turnMotorModifier = this.configuration.leftMotor === 'A' ? 1 : -1;
    const leftTurn = this.configuration.turnSpeed * (degrees > 0 ? 1 : -1) * turnMotorModifier;
    const rightTurn = this.configuration.turnSpeed * (degrees > 0 ? -1 : 1) * turnMotorModifier;
    const dutyCycleA = this.configuration.leftMotor === 'A' ? leftTurn : rightTurn;
    const dutyCycleB = this.configuration.leftMotor === 'A' ? rightTurn : leftTurn;
    return this.motorAngleMultiAsync(angle, dutyCycleA, dutyCycleB, wait);
  }

  /**
   * Drive untill sensor shows object in defined distance
   * @method Hub#driveUntil
   * @param {number} [distance=0] distance in centimeters (default) or inches when to stop. Distance sensor is not very sensitive or accurate.
   * By default will stop when sensor notices wall for the first time. Sensor distance values are usualy between 110-50.
   * @param {boolean} [wait=true] will promise wait untill the bot will stop.
   * @returns {Promise}
   */
  async driveUntil(distance: number = 0, wait: boolean = true): Promise<any> {
    const distanceCheck =
      distance !== 0 ? (this.useMetric ? distance : distance * 2.54) : this.configuration.defaultStopDistance;
    const direction = this.configuration.leftMotor === 'A' ? 1 : -1;
    const compareFunc = direction === 1 ? () => distanceCheck >= this.distance : () => distanceCheck <= this.distance;
    this.motorTimeMulti(60, this.configuration.driveSpeed * direction, this.configuration.driveSpeed * direction);
    if (wait) {
      await waitForValueToSet.bind(this)('distance', compareFunc);
      await this.motorAngleMultiAsync(0);
    } else {
      return waitForValueToSet
        .bind(this)('distance', compareFunc)
        .then(_ => this.motorAngleMulti(0, 0, 0));
    }
  }

  /**
   * Turn until there is no object in sensors sight
   * @method Hub#turnUntil
   * @param {number} [direction=1] direction to turn to. 1 (or any positive) is to the right and 0 (or any negative) is to the left.
   * @param {boolean} [wait=true] will promise wait untill the bot will stop.
   * @returns {Promise}
   */
  async turnUntil(direction: number = 1, wait: boolean = true): Promise<any> {
    const directionModifier = direction > 0 ? 1 : -1;
    this.turn(360 * directionModifier, false);
    if (wait) {
      await waitForValueToSet.bind(this)('distance', () => this.distance >= this.configuration.defaultClearDistance);
      await this.turn(0, false);
    } else {
      return waitForValueToSet
        .bind(this)('distance', () => this.distance >= this.configuration.defaultClearDistance)
        .then(_ => this.turn(0, false));
    }
  }

  updateConfiguration(configuration: BoostConfiguration): void {
    validateConfiguration(configuration);
    this.configuration = configuration;
  }
}
