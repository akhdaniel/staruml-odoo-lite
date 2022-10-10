Odoo Extension for StarUML Pro Version 
============================

This extension for StarUML(http://staruml.io) support to generate Odoo code from UML model. Install this extension from Extension Manager of StarUML.

Understanding UML diagrams:
https://creately.com/blog/diagrams/class-diagram-relationships/


Installation
----------------------

Please check here for detailed installtion process of the extension:

https://docs.staruml.io/user-guide/managing-extensions


Odoo Code Generation
----------------------

1. Click the menu (`Tools > Odoo > Generate Code...`)
2. Select a base model (or package) that will be generated to Odoo.
3. Select a folder where generated Odoo source files (.py) will be placed.

Belows are the rules to convert from UML model elements to Odoo source codes.

### Odoo object name

* create an attributed called `_name` on the class
* set the name on `defaultValue` field, eg `module.classname`


### Odoo inherit object

* if the object is inherted from other object create a attribute called `_inherit` 
* the parent object is set on `defaultValue` field, eg `res.partner`

### Odoo fields

* set the Odoo field type on `type` field 
* Example `Char()` will be converted to `fields.Char()`, `Integer()` to `fields.Integer()`


### Odoo help attributes

* The `Documentation` field will bo converted to `help=` attribute 


### UMLPackage

* converted to a python _Package_ (as a folder with `__init__.py`).

### UMLClass, UMLInterface

* converted to a python _Class_ definition as a separated module (`.py`).
* `documentation` property to docstring

### UMLEnumeration

* converted to a python class inherited from _Enum_ as a separated module (`.py`).
* literals converted to class variables

### Odoo Relation fields, UMLAttribute, UMLAssociationEnd

* converted to an instance variable
* `name` property to identifier
* `documentation` property to docstring
* If `multiplicity` is one of `0..*`, `1..*`, `*`, then the variable will be initialized with:
	* `0..*` or `1..*` : fields.One2Many()
	* `1` : fields.Many2one()
	* `*` : fields.Many2many()

### UMLOperation

* converted to an instance method if `isStatic` property is true, or a class method (`@classmethod`) if `isStatic` property is false
* `name` property to identifier
* `documentation` property to docstring
* _UMLParameter_ to method parameter

### UMLGeneralization, UMLInterfaceRealization

* converted to inheritance

