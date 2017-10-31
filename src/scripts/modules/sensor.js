
const NAME = Symbol();

class Sensor {
  constructor (val) {
    this[NAME] = val;

    //console.log("New Sensor device (" + val + ")");
  }

  set name (val) {}
  get name () { return this[NAME]; }
  set id (val) {}
  get id () { return this[NAME]; }

}
export default Sensor;


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
