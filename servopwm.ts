/**
 * Provides access to advanced servo controll.
 */
//% color=#285256 icon="\uf085" block="Servo PWM"
//% groups=['init', 'classic', 'advanced']
namespace servoPWM {
    /*
    * Applicable scale of servo speed.
    */
    export enum Speed {
        SlowestUltra = 60,
        Slowest = 30,
        Slow = 18,
        Normal = 10,
        Fast = 7,
        Fastest = 4,
        Ultra = 2,
        Immediately = 0
    }

    /**
     * Create servo object?
     * @param pin micro:bit pins (0-4, 6-10, 16)
     * @param pwmStart power on immediately
     */
    //% blockId=servoPWM_createServo
    //% block="create servo at pin %pin || with power %pwmStart"
    //% group="init"
    //% blockSetVariable=servo1
    //% pin.defl=AnalogPin.P0
    //% pwmStart.shadow="toggleOnOff" pwmStart.defl=false
    //% expandableArgumentMode="toggle"
    export function createServo(pin: AnalogPin, pwmStart: boolean = false): Servo {
        let servo = new Servo(pin, pwmStart)
        _servos.push(servo)
        return servo
    }
    
    export class Servo {
        private _pin: AnalogPin /* servo connected at */
        protected _pulse: number /* pwm pulse length in μs */
        private _throttling: number = 0 /* pause between pulseSteps [ms] */
        private _pulseStep: number = 10 /* pwm pulse length change [μs] per one step */
        private _pwmOn: boolean = false /* pin pull mode on/off */
        private _neutralPulse: number = 1500 /* "middle" pulse eg. 90 degree */
        private _minPulse: number = 500 /* "low" pulse eg. 0 degree */
        private _maxPulse: number = 2500 /* "high" pulse eg. 180 degree */
        private _minAngle: number = 0 
        private _maxAngle: number = 180 /* real deflection angle at maximum pulse length */
        private _anotherCallStack: Array<number> = [] 

        constructor(pin: AnalogPin, pwmStart: boolean = false) {
            this._pin = pin;
            this._pulse = this._neutralPulse
            this._pwmOn = pwmStart
        }   
        
        /**
         *  Set cycle duration to %milis ms
         *  (Servo transition time from min to max angle)
         *  @param milis 
         */
        //% blockId=servoPWM_setDuration
        //% block="set %this(servo) duration to %milis ms"
        //% group="classic"
        //% milis.shadow="timePicker"
        public setDuration(milis: number): void {
            this.setDelay(milis / Math.idiv(this._maxPulse - this._minPulse, this._pulseStep))
        }

        /**
         *  Get throttling value - servo delay between steps in milliseconds
         *  The number zero (0) corresponds to the maximum servo speed 
         */
        //% blockId=servoPWM_getDelay
        //% block="get %this(servo) delay in ms"
        //% group="advanced"
        public getDelay(): number {
            return this._throttling;
        }

        /**
         *  Get actual PWM pulse length in μs
         */
        //% blockId=servoPWM_getPulse
        //% block="get %this(servo) pulse"
        //% group="advanced" weight=90
        public getPulse(): number {
            return this._pulse;
        }

        /**
         *  Set throttling value
         *  @param stepDuration servo delay between steps in miliseconds
         *  (The number zero (0) corresponds to the maximum servo speed)
        */
        //% blockId=servoPWM_setDelay
        //% block="set %this(servo) delay at %stepDuration ms"
        //% group="advanced"
        //% stepDuration.min=0 stepDuration.max=100
        public setDelay(stepDuration: Speed) {
            this._throttling = Math.constrain(stepDuration, 0, 100)
        }


    // block="crickit run at $speed \\%"
    // speed.shadow="speedPicker"
    //public run(speed: number) {

        /**
         *  Set the servo angle
         *  @param degrees servo arm deflection angle in degrees [360° per turn]
        */
        //% blockId=servoPWM_setAngle
        //% block="set %this(servo) angle to %degrees °"
        //% group="classic"
        public setAngle(degrees: number): void {
            degrees = Math.constrain(degrees | 0, this._minAngle, this._maxAngle)
            this.setPulse(this._minPulse + this._angleToPulse(degrees))            
        }

        /**
         *  Change servo arm angle by XY degrees
         *  @param degrees angle in degrees
         *  (a negative number is allowed)
        */
        //% blockId=servoPWM_setAngleBy
        //% block="change %this(servo) angle by %degrees °"
        //% group="classic"
        public setAngleBy(degrees: number): void {
            degrees = Math.constrain(degrees | 0, this._minAngle, this._maxAngle)
            this.setPulse(this._pulse + this._angleToPulse(degrees))
        }

        /**
         *  Pulse length change by XY microseconds
         *  @param micros servo pwm pulse change in microseconds
         *  (a negative number is allowed)
        */
        //% blockId=servoPWM_setPulseBy
        //% block="change %this(servo) pulse by %micros μs"
        //% group="advanced"
        public setPulseBy(micros: number): void {
            this.setPulse(micros + this._pulse)
        }

        /**
         *  Set the servo pwm pulse length
         *  @param micros servo pwm pulse length in microseconds
         *  (Usually between 500 and 2500 μs)
        */
        //% blockId=servoPWM_setPulse
        //% block="set %this(servo) pulse to %micros μs"
        //% group="advanced"
        public setPulse(micros: number):void {
            micros = Math.constrain(micros | 0, this._minPulse, this._maxPulse)
            if (this._throttling == Speed.Immediately) {
                this._anotherCallStack.push(control.millis())
                this._pulse = micros
                this._pwmOn = true
                return
            }
            this._pwmOn = true

            control.inBackground(function () {
                this._setPulse(micros);
            })            
        }

        /**
         *  Stop sending commands to the servo so that its rotation will stop at the current position.
         *  (It will also not provide any holding force.)
        */
        //% blockId=servoPWM_stop
        //% block="stop %this(servo)"
        //% group="advanced" weight=100
        public stop(): void {
            this._pwmOn = false
            pins.digitalReadPin(<number> this._pin)
            pins.setPull(<number> this._pin, PinPullMode.PullNone)
        }

        /**
         *  Set maximum angle in degrees (default 180°)
         *  @param degrees angle in degrees
        */
        //% blockId=servoPWM_setMaxAngle
        //% block="set %this(servo) max angle at %degrees °"
        //% group="advanced"
        public setMaxAngle(degrees: number) {
            this._maxAngle = Math.constrain(degrees | 0, this._minAngle, 3600)
        }

        /**
         *  Set minimum angle in degrees (default 0°)
         *  @param degrees angle in degrees
         * (a negative number is allowed)
        */
        //% blockId=servoPWM_setMinAngle
        //% block="set %this(servo) min angle at %degrees °"
        //% group="advanced"
        public setMinAngle(degrees: number) {
            this._minAngle = Math.constrain(degrees | 0, -3600, this._maxAngle)
        }

        /**
         *  Set maximum pulse length in μs
         *  @param pulse pulse length in μs
        */
        //% blockId=servoPWM_setMaxPulse
        //% block="set %this(servo) max pulse to %pulse μs"
        //% group="advanced"
        public setMaxPulse(pulse: number) {
            this._maxPulse = Math.constrain(pulse | 0, this._minPulse, 3000)
        }

        /**
         *  Set minimum pulse length in μs
         *  @param pulse pulse length in μs
        */
        //% blockId=servoPWM_setMinPulse
        //% block="set %this(servo) min pulse to %pulse μs"
        //% group="advanced"
        public setMinPulse(pulse: number) {
            this._minPulse = Math.constrain(pulse | 0, 250, this._maxPulse)
        }

        private _setPulse(pulse: number):void {
            let direction: number = this._pulse < pulse ? 1 : -1
            let pulseFrom = Math.min(this._pulse, pulse);
            let pulseTo = Math.max(this._pulse, pulse)

            if (Math.abs(pulseFrom - pulseTo) < this._pulseStep) return

            this._anotherCallStack.push(control.millis())
            let anotherCallsCount = this._anotherCallStack.length

            for(let k = 0; k < Math.round(Math.abs(pulseFrom - pulseTo) / this._pulseStep); k++) {
                if (!this._pwmOn) return
                if (anotherCallsCount != this._anotherCallStack.length) return
                this._pulse += this._pulseStep * direction
                basic.pause(this._throttling)
            }
            //clean after anotherCalls breakout
            this._anotherCallStack = []   
        }

        private _angleToPulse(degrees: number): number {
            return (this._maxPulse - this._minPulse) *
                ((degrees - this._minAngle) / (this._maxAngle - this._minAngle))
        }

        public callPulse(): void {
            if (this._pwmOn) {
                pins.servoSetPulse(this._pin, this._pulse) //50Hz max
                console.logValue("pulse"+ this._pin, this._pulse)
            }
        }
    }

    const _servos: Array<Servo> = []

    control.inBackground(function () {
        //let start
        while (true) {
            for (let i = 0; i < _servos.length; i++)
            {
                //start = input.runningTimeMicros()
                _servos[i].callPulse()
                //console.logValue("dr", input.runningTimeMicros() - start)
            }
            basic.pause(20)
        }
    })
}
