/**
 * Provides access to advanced servo controll.
 */
//% color=#285256 icon="\uf085" block="Servo PWM"
//% groups=['Servo', 'Servo methods']
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
    //% block="Create servo at pin %pin || with power %pwmStart"
    //% group="Servo"
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
        private _pin: AnalogPin
        protected _pulse: number
        private _throttling: number = 0
        private _pulseStep: number = 10
        private _pwmOn: boolean = false
        private _neutralPulse: number = 1500
        private _minPulse: number = 500
        private _maxPulse: number = 2500
        private _minAngle: number = 0
        private _maxAngle: number = 180
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
        //% block="Set %this(servo) duration to %milis ms"
        //% group="Servo methods"
        //% milis.shadow="timePicker"
        public setDuration(milis: number): void {
            this.setDelay(milis / Math.idiv(this._maxPulse - this._minPulse, this._pulseStep))
        }

        /**
         *  Get throttling value - servo delay between steps in milliseconds
         *  The number zero (0) corresponds to the maximum servo speed 
         */
        //% blockId=servoPWM_getDelay
        //% block="Get %this(servo) delay in ms"
        //% group="Servo methods"
        public getDelay(): number {
            return this._throttling;
        }

        /**
         *  Set throttling value
         *  @param stepDuration servo delay between steps in miliseconds
         *  (The number zero (0) corresponds to the maximum servo speed)
        */
        //% blockId=servoPWM_setDelay
        //% block="Set %this(servo) delay at %stepDuration ms"
        //% group="Servo methods"
        //% stepDuration.min=0 stepDuration.max=100
        public setDelay(stepDuration: Speed) {
            this._throttling = Math.constrain(stepDuration, 0, 100)
        }


        // block="crickit run at $speed \\%"
        // speed.shadow="speedPicker"
        //public run(speed: number) {

///nedokončeno
        public setAngle(angle: number): void {
            angle = Math.constrain(angle, this._minAngle, this._maxAngle)
        }

        public setPulseBy(pulseStep: number): void {
            this.setPulse(pulseStep + this._pulse)
        }

        public setPulse(pulse: number):void {
            pulse = Math.constrain(pulse, this._minPulse, this._maxPulse)
            if (this._throttling == Speed.Immediately) {
                this._anotherCallStack.push(control.millis())
                this._pulse = pulse
                this._pwmOn = true
                return
            }
            this._pwmOn = true

            control.inBackground(function () {
                this._setPulse(pulse);
            })            
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

        public stop(): void {
            this._pwmOn = false
            pins.digitalReadPin(<number> this._pin)
            pins.setPull(<number> this._pin, PinPullMode.PullNone)
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
