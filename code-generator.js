/*
 * Copyright (c) 2019 vitraining.com. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * Version 1.10 (13 Sep 2022)
 * - pivot view
 * - automatic "ref" field on inherited addon, for res.partner, res.users, res.currency, account.account, account.journal, and all defined classes
 * - sequence data moved to main addon; to modify the sequence, set and enable the sequence XML on the inherited module's manifest
 * - report tag for version 14 and above
 * - menu and action for inherited classes
 * 
 * Version 1.8 (10 Nov 2020)
 * - en_language parameter: add 's' on One2many language or not
 * - xml form tree on inherited addon
 * 
 * Version 1.7 (3 Nov 2020)
 * - appName parameter = for menu 
 * - addonName parameter = class namespace
 * - if state field exist: create sequence and auto number for name field
 * - icon parameter: icon1,icon2,... icon10
 * - odooVersion parameter = to generate classes for odoo13+ or below
 * - automatic sequence for menu
 * - menu "AppName / Operations" for all objects with state field
 * - menu "AppName / Configuration" for all objects without state field
 * - kanban information template m2o and date fields
 * - group "AppName / Manager" dan "AppName / User"
 * - ir.model.access.csv for those groups 
 * - unlink to protect draft only record
 * 
 * Version 1.6 (19 April 2020)
 * - bug fix state readonly on 'state' field
 * - auto add button confirm if state exists
 * - auto create action button methods if state exists in main and inherited class 
 * - auto add global variabel STATES if states exists 
 * 
 * 
 * Version 1.5 (9 April 2020)
 * - add _description on every model 
 * - add readonly=True states={"draft" : [("readonly",False)]}  if state field exists 
 * - add static/description folder 
 * - add static/description/icon.png 
 * - add static/js folder 
 * - add static/xml folder 
 */

const fs = require('fs')
const path = require('path')
const codegen = require('./codegen-utils')

/**
 * Odoo Code Generator
 */
class OdooCodeGenerator {
    /**
     * @constructor
     *
     * @param {type.UMLPackage} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    constructor(baseModel, basePath) {
        /** @member {type.Model} */
        this.baseModel = baseModel

        /** @member {string} */
        this.basePath = basePath
    }

    /**
     * Return Indent String based on options
     * @param {Object} options
     * @return {string}
     */
    getIndentString(options) {
        if (options.useTab) {
            return '\t'
        } else {
            var i, len
            var indent = []
            for (i = 0, len = options.indentSpaces; i < len; i++) {
                indent.push(' ')
            }
            return indent.join('')
        }
    }

    /**
     * Collect inheritances (super classes or interfaces) of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    getInherits(elem) {
        var inherits = app.repository.getRelationshipsOf(elem, function(rel) {
            return (rel.source === elem && (rel instanceof type.UMLGeneralization || rel instanceof type.UMLInterfaceRealization))
        })
        return inherits.map(function(gen) { return gen.target })
    }

    /**
     * Write Doc
     * @param {StringWriter} codeWriter
     * @param {string} text
     * @param {Object} options
     */
    writeDoc(codeWriter, text, options) {
        var i, len, lines
        if (options.docString && text.trim().length > 0) {
            lines = text.trim().split('\n')
            if (lines.length > 1) {
                codeWriter.writeLine('"""')
                for (i = 0, len = lines.length; i < len; i++) {
                    codeWriter.writeLine(lines[i])
                }
                codeWriter.writeLine('"""')
            } else {
                codeWriter.writeLine('"""' + lines[0] + '"""')
            }
        }
    }

    /**
     * Write Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param isClassVar
     * @param inverse_field
     * @param stateExist
     * 
     * dijalankan per field elem 
     */
    writeVariable(codeWriter, elem, options, isClassVar, inverse_field, stateExist) {
        var addonName = options.addonName

        if (elem.name.length > 0) {
            var line
            var nameOrInherit = elem.name && ["_name", "_inherit"].includes(elem.name)


            if (nameOrInherit) {
                if (elem.name == "_inherit") {
                    line = elem.name
                    line += ' = "' + elem.defaultValue + '"'
                }
            }

            // relational fields
            else if (elem.multiplicity && ['0..*', '1..*', '*', '1'].includes(elem.multiplicity.trim())) {
                line = elem.name
                    // attribut = fields.Many2one(comodel_name="addon.refference",
                if (elem.multiplicity == '0..*') {
                    line += ' = fields.Many2one(comodel_name="' + this.getModelName(inverse_field.reference, options, ".") + '", '
                        // line += ' = fields.Many2one(comodel_name="'+addonName + '.' + inverse_field.reference.name + '", '
                }
                // attribut = fields.One2many(comodel_name="addon.refference", inverse_name="" 
                else if (elem.multiplicity == '1') {
                    line += ' = fields.One2many(comodel_name="' + this.getModelName(inverse_field.reference, options, ".") + '", '
                    line += ' inverse_name="' + inverse_field.name + '", '
                }
                // attribut = fields.Many2many(comodel_name="addon.refference", 
                else if (elem.multiplicity == '*') {
                    line += ' = fields.Many2many(comodel_name="' + this.getModelName(inverse_field.reference, options, ".") + '", '
                }

            }
            // attribute = fields.type( 
            else if (elem.type == 'Selection') {
                if (elem.name !== 'state') {
                    line = elem.name + ' = fields.Selection(selection=[' + elem.defaultValue + '], '
                } else {
                    line = elem.name + ' = fields.Selection(selection=STATES, '
                    line += " readonly=True, default=STATES[0][0], "
                }
            } else {
                line = elem.name
                line += ' = fields.' + elem.type + '('
            }


            // add more attributes
            if (elem.name === 'name') {
                line += ' required=True,'
                if (stateExist) {
                    line += ' default="New", readonly=True, '
                } else if (elem.defaultValue) {
                    line += ' default="' + elem.defaultValue + '", '
                }
            }

            // add string 
            // attribute = fields([XXXXXX,] string="titlecase(name)", 
            if (!nameOrInherit) {
                line += ' string="' + this.sentenceCase(elem.name, options) + '", '


                //add readonly is there's state field 
                if (stateExist) {
                    if (elem.name !== 'name' && elem.name !== 'state') {
                        line += ' readonly=True, states={"draft" : [("readonly",False)]}, '
                    }
                }
                // add help and close
                // attribute = fields.XXXXX([XXXXXX,] string="titlecase(name)", help="documentation")
                line += ' help="' + elem.documentation + '"'
                line += ')'
            }
            codeWriter.writeLine(line)
        }
    }

    /**
     * Write Constructor
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeConstructor(codeWriter, elem, options) {
        var self = this
        var hasBody = false
        codeWriter.writeLine('def __init__(self):')
        codeWriter.indent()

        // from attributes
        if (elem.attributes.length > 0) {
            elem.attributes.forEach(function(attr) {
                if (attr.isStatic === false) {
                    self.writeVariable(codeWriter, attr, options, true)
                    hasBody = true
                }
            })
        }

        // from associations
        var associations = app.repository.getRelationshipsOf(elem, function(rel) {
            return (rel instanceof type.UMLAssociation)
        })
        console.log(associations);
        for (var i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
                // if (asso.end1.reference === elem && asso.end2.navigable === true) {
            if (asso.end1.reference === elem) {
                self.writeVariable(codeWriter, asso.end2, options)
                hasBody = true
            }
            // if (asso.end2.reference === elem && asso.end1.navigable === true) {
            if (asso.end2.reference === elem) {
                self.writeVariable(codeWriter, asso.end1, options)
                hasBody = true
            }
        }

        if (!hasBody) {
            codeWriter.writeLine('pass')
        }

        codeWriter.outdent()
        codeWriter.writeLine()
    }

    /**
     * Write Method
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipBody
     * @param {boolean} skipParams
     */
    writeMethod(codeWriter, elem, options) {
        codeWriter.writeLine()

        if (elem.name.length > 0) {
            // name
            var line = 'def ' + elem.name

            // params
            var params = elem.getNonReturnParameters()
            var paramStr = params.map(function(p) { return p.name }).join(', ')

            if (elem.isStatic) {
                codeWriter.writeLine('@classmethod')
                codeWriter.writeLine(line + '(cls, ' + paramStr + '):')
            } else {
                codeWriter.writeLine(line + '(self, ' + paramStr + '):')
            }
            codeWriter.indent()
            this.writeDoc(codeWriter, elem.documentation, options)
            codeWriter.writeLine('pass')
            codeWriter.outdent()
            codeWriter.writeLine()
        }
    }

    /**
     * Write Action Method
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipBody
     * @param {boolean} skipParams
     */
    writeCreateMethod(codeWriter, className, objectName, options, withSequence) {
            var odooVersion = options.odooVersion
            codeWriter.writeLine()

            codeWriter.writeLine('@api.model')
            codeWriter.writeLine('def create(self, vals):')
            codeWriter.indent()
            if (withSequence) {
                codeWriter.writeLine('if not vals.get("name", False) or vals["name"] == "New":')
                codeWriter.indent()
                codeWriter.writeLine('vals["name"] = self.env["ir.sequence"].next_by_code("' + objectName + '") or "Error Number!!!"')
                codeWriter.outdent()
            }
            codeWriter.writeLine('return super(' + className + ', self).create(vals)')
            codeWriter.outdent()
        }
        /**
         * Write Action Method
         * @param {StringWriter} codeWriter
         * @param {type.Model} elem
         * @param {Object} options
         * @param {boolean} skipBody
         * @param {boolean} skipParams
         */
    writeActionMethod(codeWriter, className, objectName, options) {

        var odooVersion = options.odooVersion

        codeWriter.writeLine()
        codeWriter.writeLine('def action_confirm(self):')
        codeWriter.indent()
        codeWriter.writeLine('self.state = STATES[1][0]')
        codeWriter.outdent()

        codeWriter.writeLine()
        codeWriter.writeLine('def action_done(self):')
        codeWriter.indent()
        codeWriter.writeLine('self.state = STATES[2][0]')
        codeWriter.outdent()

        codeWriter.writeLine()
        codeWriter.writeLine('def action_draft(self):')
        codeWriter.indent()
        codeWriter.writeLine('self.state = STATES[0][0]')
        codeWriter.outdent()


        codeWriter.writeLine()
        if (odooVersion < 13)
            codeWriter.writeLine('@api.multi')
        codeWriter.writeLine('def unlink(self):')
        codeWriter.indent()
        codeWriter.writeLine('for me_id in self :')
        codeWriter.indent()
        codeWriter.writeLine('if me_id.state != STATES[0][0]:')
        codeWriter.indent()
        codeWriter.writeLine('raise UserError("Cannot delete non draft record!")')
        codeWriter.outdent()
        codeWriter.outdent()
        codeWriter.writeLine('return super(' + className + ', self).unlink()')
        codeWriter.outdent()
    }

    /**
     * Write Enum
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeEnum(codeWriter, elem, options) {
        var line = ''

        codeWriter.writeLine('from enum import Enum')
        codeWriter.writeLine()

        // Enum
        line = 'class ' + elem.name + '(Enum):'
        codeWriter.writeLine(line)
        codeWriter.indent()

        // Docstring
        this.writeDoc(codeWriter, elem.documentation, options)

        if (elem.literals.length === 0) {
            codeWriter.writeLine('pass')
        } else {
            for (var i = 0, len = elem.literals.length; i < len; i++) {
                codeWriter.writeLine(elem.literals[i].name + ' = ' + (i + 1))
            }
        }
        codeWriter.outdent()
        codeWriter.writeLine()
    }

    writeInit(codeWriter, ownedElements, options) {
        var self = this
        var line = ''
        var addonName = options.addonName
        ownedElements.forEach(child => {
            if (child instanceof type.UMLClass) {
                codeWriter.writeLine('from . import ' + child.name)
            }
        })

    }

    writeModelAccess(fullPath, ownedElements, folderName, options) {
        var self = this
        var codeWriter = new codegen.CodeWriter('\t')
        var appName = options.appName
        var appNameLower = appName.toLowerCase()
        var userGroup = folderName + '.group_' + appNameLower + '_user'
        var managerGroup = folderName + '.group_' + appNameLower + '_manager'

        codeWriter.writeLine('"id","name","model_id:id","group_id:id","perm_read","perm_write","perm_create","perm_unlink"')

        ownedElements.forEach(elem => {
            if (elem instanceof type.UMLClass) {

                var is_inherit = self.checkInherit(elem)
                if (!is_inherit) {
                    var model_name_underscore = this.getModelName(elem, options, '_')
                    var model_name_dot = this.getModelName(elem, options, '.')
                    var model_name_title = this.sentenceCase(elem.name, options)
                    codeWriter.writeLine('access_user_' + model_name_underscore + ',access_user_' + model_name_underscore + ',model_' + model_name_underscore + ',' + userGroup + ',1,0,0,0')
                    codeWriter.writeLine('access_manager_' + model_name_underscore + ',access_manager_' + model_name_underscore + ',model_' + model_name_underscore + ',' + managerGroup + ',1,1,1,1')
                    codeWriter.writeLine('access_admin_' + model_name_underscore + ',access_admin_' + model_name_underscore + ',model_' + model_name_underscore + ',base.group_system,1,1,1,1')

                }
            }
        })
        fs.writeFileSync(fullPath + '/security/ir.model.access.csv', codeWriter.getData())

    }


    writeGroupsXML(fullPath, options) {
        var appName = options.appName
        var appNameLower = appName.toLowerCase()

        var xmlWriter = new codegen.CodeWriter('\t')
        xmlWriter.writeLine('<odoo>')
        xmlWriter.indent()
        xmlWriter.writeLine('<data>')
        xmlWriter.indent()

        xmlWriter.writeLine('<record model="ir.module.category" id="module_category_' + appNameLower + '">')
        xmlWriter.indent()
        xmlWriter.writeLine('<field name="name">' + appName + '</field>')
        xmlWriter.writeLine('<field name="description">' + appName + ' Groups</field>')
        xmlWriter.writeLine('<field name="sequence">10</field>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</record>')

        xmlWriter.writeLine('<record id="group_' + appNameLower + '_user" model="res.groups">')
        xmlWriter.indent()
        xmlWriter.writeLine('<field name="name">User</field>')
        xmlWriter.writeLine('<field name="category_id" ref="module_category_' + appNameLower + '"/>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</record>')

        xmlWriter.writeLine('<record id="group_' + appNameLower + '_manager" model="res.groups">')
        xmlWriter.indent()
        xmlWriter.writeLine('<field name="name">Manager</field>')
        xmlWriter.writeLine('<field name="category_id" ref="module_category_' + appNameLower + '"/>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</record>')

        xmlWriter.outdent()
        xmlWriter.writeLine('</data>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</odoo>')

        fs.writeFileSync(fullPath + '/security/groups.xml', xmlWriter.getData())
    }

    writeManifest(codeWriter, ownedElements, options, folderName, inheritedModule) {
            var self = this
            var line = ''
            var addonName = folderName
            var appName = options.appName
            var depends = options.depends

            codeWriter.writeLine('#-*- coding: utf-8 -*-')
            codeWriter.writeLine()

            codeWriter.writeLine('{')
            codeWriter.indent()
            codeWriter.writeLine('"name": "' + appName + (inheritedModule ? " Inherited" : "") + '",')
            codeWriter.writeLine('"version": "1.0", ')
            codeWriter.writeLine('"depends": [')
            codeWriter.indent()
            codeWriter.writeLine(depends + ",")
            if (inheritedModule) {
                codeWriter.writeLine("'" + folderName + "'")
            }
            codeWriter.outdent()
            codeWriter.writeLine('],')
            codeWriter.writeLine('"author": "Akhmad D. Sembiring [vitraining.com]",')
            codeWriter.writeLine('"category": "Utility",')
            codeWriter.writeLine('"website": "http://vitraining.com",')
            codeWriter.writeLine('"images": ["static/description/images/main_screenshot.jpg"],')
            codeWriter.writeLine('"price": "10",')
            codeWriter.writeLine('"license": "OPL-1",')
            codeWriter.writeLine('"currency": "USD",')
            codeWriter.writeLine('"summary": "This is the ' + appName + ' module generated by StarUML Odoo Generator Pro Version",')
            codeWriter.writeLine('"description": """')
            codeWriter.outdent()
            codeWriter.writeLine()
            codeWriter.writeLine('Information')
            codeWriter.writeLine('======================================================================')
            codeWriter.writeLine()
            codeWriter.writeLine('* created menus')
            codeWriter.writeLine('* created objects')
            codeWriter.writeLine('* created views')
            codeWriter.writeLine('* logics')
            codeWriter.writeLine()
            codeWriter.writeLine('""",')
            codeWriter.indent()
            codeWriter.writeLine('"data": [')
            codeWriter.indent()

            if (!inheritedModule) {
                codeWriter.writeLine('"security/groups.xml",')
                codeWriter.writeLine('"security/ir.model.access.csv",')
                codeWriter.writeLine('"view/menu.xml",')

                ownedElements.forEach(child => {
                    if (child instanceof type.UMLClass) {
                        var is_inherit = self.checkInherit(child)
                        if (!is_inherit) {
                            codeWriter.writeLine('"view/' + child.name + '.xml",')
                        } else {
                            codeWriter.writeLine('"view/' + child.name + '.xml", #inherited')
                        }


                        // sequence 
                        var state_field_exist = false
                            // get fields names
                        child.attributes.forEach(function(attr) {
                            if (attr.name === 'state') {
                                state_field_exist = true
                            }
                        })

                        if (state_field_exist)
                            codeWriter.writeLine('"data/sequence_' + child.name + '.xml",')
                    }
                })


                ownedElements.forEach(child => {
                    if (child instanceof type.UMLClass) {
                        codeWriter.writeLine('"report/' + child.name + '.xml",')
                    }
                })

            } else {
                //inherirted module

                ownedElements.forEach(child => {
                    if (child instanceof type.UMLClass) {
                        codeWriter.writeLine('# "view/' + child.name + '.xml",')

                        var state_field_exist = false
                        child.attributes.forEach(function(attr) {
                            if (attr.name === 'state') {
                                state_field_exist = true
                            }
                        })

                        if (state_field_exist)
                            codeWriter.writeLine('# "data/sequence_' + child.name + '.xml",')
                    }
                })
            }

            codeWriter.outdent()
            codeWriter.writeLine('],')
            codeWriter.writeLine('"installable": True,')
            codeWriter.writeLine('"auto_install": False,')
            codeWriter.writeLine('"application": True,')
            codeWriter.outdent()
            codeWriter.writeLine('}')
        }
        /**
         * Write Class per model 
         * @param {StringWriter} codeWriter
         * @param {type.Model} elem
         * @param {Object} options
         */
    writeClass(codeWriter, elem, options) {
        var self = this
        var line = ''
        var addonName = options.addonName
        var odooVersion = options.odooVersion
        var stateExist = false
        var className = elem.name
        var objectName = ''

        // cek state exists ?
        elem.attributes.forEach(function(attr) {
            if (attr.name === 'state') {
                stateExist = true
                codeWriter.writeLine('STATES = [' + attr.defaultValue + ']')
            }
        })

        // Import
        codeWriter.writeLine('from odoo import models, fields, api, _')
        codeWriter.writeLine('from odoo.exceptions import UserError, Warning')
        codeWriter.writeLine(line)

        // Class
        line = 'class ' + className + '(models.Model):'
        codeWriter.writeLine(line)
        codeWriter.indent()

        // Docstring
        this.writeDoc(codeWriter, elem.documentation, options)
        codeWriter.writeLine()

        if (elem.attributes.length === 0 && elem.operations.length === 0) {
            codeWriter.writeLine('pass')
        } else {

            objectName = this.getModelName(elem, options, '.')

            line = '_name = "' + objectName + '"'
            codeWriter.writeLine(line)

            line = '_description = "' + objectName + '"'
            codeWriter.writeLine(line)


            //write fields 
            elem.attributes.forEach(function(attr) {
                self.writeVariable(codeWriter, attr, options, true, false, stateExist)
            })
            codeWriter.writeLine()

            // Methods
            if (elem.operations.length > 0) {
                elem.operations.forEach(function(op) {
                    self.writeMethod(codeWriter, op, options)
                })
            }

            if (stateExist) {
                var withSequence = true
                self.writeCreateMethod(codeWriter, className, objectName, options, withSequence)
                self.writeActionMethod(codeWriter, className, objectName, options)
            }

        } // end ada attributes

        codeWriter.writeLine()

        // from associations: Many2one, One2many, Many2many
        var associations = app.repository.getRelationshipsOf(elem, function(rel) {
            return (rel instanceof type.UMLAssociation)
        })
        console.log(associations);

        //looping associations
        for (var i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
                // if (asso.end1.reference === elem && asso.end2.navigable === true) {
            if (asso.end1.reference === elem) {
                // end1 = class ini => Many2one
                self.writeVariable(codeWriter, asso.end1, options, true, asso.end2, stateExist)
            }
            // if (asso.end2.reference === elem && asso.end1.navigable === true) {
            if (asso.end2.reference === elem) {
                // end2 = class ini => One2many
                self.writeVariable(codeWriter, asso.end2, options, true, asso.end1, stateExist)
            }
        }


        // if stateExist: write action button 
        // if (stateExist) {
        //     self.writeActionMethod(codeWriter, className, objectName, options)
        // }

        codeWriter.outdent()
        codeWriter.writeLine()
    }

    /**
     * Write Inherited Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeInheritedClass(codeWriter, elem, options) {
        var self = this
        var line = ''
        var addonName = options.addonName
        var state_field_exist = false

        // get fields names
        elem.attributes.forEach(function(attr) {
            if (attr.name === 'state') {
                state_field_exist = true
                codeWriter.writeLine('STATES = [' + attr.defaultValue + ']')
            }
        })

        // Import
        codeWriter.writeLine('from odoo import models, fields, api, _')
        codeWriter.writeLine('from odoo.exceptions import UserError, Warning')
        codeWriter.writeLine(line)

        // Class
        var className = elem.name
        line = 'class ' + elem.name + '(models.Model):'
        codeWriter.writeLine(line)
        codeWriter.indent()
        var objectName = this.getModelName(elem, options, '.')
        line = '_name = "' + objectName + '"'
        codeWriter.writeLine(line)
        line = '_inherit = "' + objectName + '"'
        codeWriter.writeLine(line)

        // if stateExist: write action button 
        if (state_field_exist) {
            console.log('----- state_field_exist')
            var withSequence = false
            self.writeCreateMethod(codeWriter, className, objectName, options, withSequence)
            self.writeActionMethod(codeWriter, className, objectName, options)
        }
        // Methods
        if (elem.operations.length > 0) {
            elem.operations.forEach(function(op) {
                self.writeMethod(codeWriter, op, options)
            })
        }
        codeWriter.outdent()
        codeWriter.writeLine()
    }


    writeXML(xmlWriter, elem, options, folderName, sequence) {
        var self = this
        var line = ''
        var normal_fields = []
        var o2m_fields = []
        var m2o_fields = []
        var m2m_fields = []
        var addonName = options.addonName
        var odooVersion = options.odooVersion
        var model_name_underscore = this.getModelName(elem, options, '_')
        var model_name_dot = this.getModelName(elem, options, '.')
        var model_name_title = this.sentenceCase(elem.name, options)
        var date_field_exist = false
        var date_field = ''
        var image_field_exist = false
        var state_field_exist = false
        var is_inherit = self.checkInherit(elem)
        var elem_name = elem.name

        // get fields names
        elem.attributes.forEach(function(attr) {
            if (attr.name !== '' && attr.name !== undefined && attr.name != '_name' && attr.name != '_inherit') {
                normal_fields.push(attr)

                if (attr.type === 'Date' || attr.type === 'Datetime') {
                    date_field_exist = true
                    date_field = attr.name
                }
                if (attr.name === 'image_small') {
                    image_field_exist = true
                }

                if (attr.name === 'state') {
                    state_field_exist = true
                }

            }
        })

        var associations = app.repository.getRelationshipsOf(elem, function(rel) {
            return (rel instanceof type.UMLAssociation)
        })

        //looping associations
        for (var i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
                // if (asso.end1.reference === elem && asso.end2.navigable === true) {
            if (asso.end1.reference === elem) {
                // end1 = class ini => Many2one
                if (asso.end1.name !== "" && asso.end1.name !== undefined) {
                    if (asso.end1.multiplicity == '0..*' || asso.end1.multiplicity == '1..*') {
                        m2o_fields.push(asso.end1)
                    } else if (asso.end1.multiplicity == '*') {
                        m2m_fields.push(asso.end1)
                    }

                }
            }
            // if (asso.end2.reference === elem && asso.end1.navigable === true) {
            if (asso.end2.reference === elem) {
                // end2 = class ini => One2many
                if (asso.end2.name !== "" && asso.end2.name !== undefined) {
                    // console.log(asso.end2)
                    if (asso.end2.multiplicity == '1') {
                        o2m_fields.push(asso.end2)
                    } else if (asso.end2.multiplicity == '*') {
                        m2m_fields.push(asso.end2)
                    }
                }
            }
        }



        xmlWriter.writeLine('<?xml version="1.0" encoding="utf-8"?>')
        xmlWriter.writeLine('<odoo>')
        xmlWriter.indent()
        xmlWriter.writeLine('<data>')
        xmlWriter.indent()


        // if not inherit class, create XML tree, form, etc
        if (!is_inherit) {



            xmlWriter.writeLine('<!-- tree view -->')

            xmlWriter.writeLine('<record id="view_' + model_name_underscore + '_tree" model="ir.ui.view">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + model_name_underscore + '_tree</field>')
            xmlWriter.writeLine('<field name="model">' + model_name_dot + '</field>')
            xmlWriter.writeLine('<field name="type">tree</field>')
            xmlWriter.writeLine('<field name="priority" eval="8"/>')
            xmlWriter.writeLine('<field name="arch" type="xml">')
            xmlWriter.indent()
            xmlWriter.writeLine('<tree string="' + model_name_title + '">')
            xmlWriter.indent()
            normal_fields.forEach(function(field) {
                xmlWriter.writeLine('<field name="' + field.name + '" />')
            })
            m2o_fields.forEach(function(field) {
                xmlWriter.writeLine('<field name="' + field.name + '" />')
            })
            xmlWriter.outdent()
            xmlWriter.writeLine('</tree>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')



            xmlWriter.writeLine('<!-- form view -->')

            xmlWriter.writeLine('<record id="view_' + model_name_underscore + '_form" model="ir.ui.view">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + model_name_underscore + '_form</field>')
            xmlWriter.writeLine('<field name="model">' + model_name_dot + '</field>')
            xmlWriter.writeLine('<field name="type">form</field>')
            xmlWriter.writeLine('<field name="priority" eval="8"/>')
            xmlWriter.writeLine('<field name="arch" type="xml">')
            xmlWriter.indent()
            xmlWriter.writeLine('<form string="' + model_name_title + '">')
            xmlWriter.indent()
            xmlWriter.writeLine('<header>')
            xmlWriter.indent()
            if (state_field_exist) {
                xmlWriter.writeLine('<button string="Confirm" type="object" name="action_confirm" states="draft" />')
                xmlWriter.writeLine('<button string="Mark as Done" type="object" name="action_done" states="open" />')
                xmlWriter.writeLine('<button string="Reset to Draft" type="object" name="action_draft" states="open,done" />')
                xmlWriter.writeLine('<field name="state" widget="statusbar" />')
            }
            xmlWriter.outdent()
            xmlWriter.writeLine('</header>')
            xmlWriter.writeLine('<sheet>')
            xmlWriter.indent()
            xmlWriter.writeLine('<div class="oe_button_box" name="button_box">')
            xmlWriter.indent()
            xmlWriter.writeLine('<!--button type="object" name="action_view_detail" class="oe_stat_button" icon="fa-pencil-square-o"-->')
            xmlWriter.indent()
            xmlWriter.writeLine('<!--field name="detail_count" widget="statinfo" string="Detail(s)"/-->')
            xmlWriter.writeLine('<!--field name="detail_ids" invisible="1"/-->')
            xmlWriter.outdent()
            xmlWriter.writeLine('<!--/button-->')
            xmlWriter.outdent()
            xmlWriter.writeLine('</div>')
            xmlWriter.writeLine('<div class="oe_title">')
            xmlWriter.indent()
            xmlWriter.writeLine('<label for="name" class="oe_edit_only" string="' + model_name_title + ' Name"/>')
            xmlWriter.writeLine('<h1><field name="name"/></h1>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</div>')
            xmlWriter.writeLine('<group>')
            xmlWriter.indent()
            xmlWriter.writeLine('<group>')
            xmlWriter.indent()
            normal_fields.forEach(function(field) {
                if (field.name !== 'name' && field.name !== 'state') {
                    xmlWriter.writeLine('<field name="' + field.name + '" />')
                }
            })
            xmlWriter.outdent()
            xmlWriter.writeLine('</group>')

            xmlWriter.writeLine('<group>')
            xmlWriter.indent()
            m2o_fields.forEach(function(field) {
                xmlWriter.writeLine('<field name="' + field.name + '" />')
            })
            m2m_fields.forEach(function(field) {
                xmlWriter.writeLine('<field name="' + field.name + '" widget="many2many_tags"/>')
            })
            xmlWriter.outdent()
            xmlWriter.writeLine('</group>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</group>')

            xmlWriter.writeLine('<notebook>')
            xmlWriter.indent()
            o2m_fields.forEach(function(field) {
                xmlWriter.writeLine('<page name="' + field.name + '" string="' + self.sentenceCase(field.name, options) + '">')
                xmlWriter.indent()
                xmlWriter.writeLine('<field name="' + field.name + '"/>')
                xmlWriter.outdent()
                xmlWriter.writeLine('</page>')
            })
            xmlWriter.outdent()
            xmlWriter.writeLine('</notebook>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</sheet>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</form>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')


        } // end if not is_inherit

        //for all class, create action window and menu except if name is res.users
        if (model_name_underscore != 'res_users') {

            xmlWriter.writeLine('<!-- action window -->')

            xmlWriter.writeLine('<record id="action_' + elem_name + '" model="ir.actions.act_window">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + model_name_title + '</field>')
            xmlWriter.writeLine('<field name="type">ir.actions.act_window</field>')
            xmlWriter.writeLine('<field name="res_model">' + model_name_dot + '</field>')
            if (odooVersion < 12) {
                xmlWriter.writeLine('<field name="view_type">form</field>')
            }
            line = '<field name="view_mode">tree,form'


            line += '</field>'
            xmlWriter.writeLine(line)
            xmlWriter.writeLine('<field name="context">{"search_default_fieldname":1}</field>')
            xmlWriter.writeLine('<field name="help" type="html">')
            xmlWriter.indent()
            xmlWriter.writeLine('<p class="oe_view_nocontent_create">')
            xmlWriter.writeLine('Click to add a new ' + model_name_title)
            xmlWriter.writeLine('</p><p>')
            xmlWriter.writeLine('Click the Create button to add a new ' + model_name_title)
            xmlWriter.writeLine('</p>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')

            xmlWriter.writeLine()
            var parentMenu = ''
            if (state_field_exist)
                parentMenu = folderName + '_sub_menu'
            else
                parentMenu = folderName + '_config_menu'
            xmlWriter.writeLine('<menuitem id="menu_' + elem_name + '" name="' + model_name_title + '" parent="' + parentMenu + '" action="action_' + elem_name + '" sequence="' + sequence + '"/>')
        } // not res.users

        xmlWriter.outdent()
        xmlWriter.writeLine('</data>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</odoo>')
    }



    writeInheritedXML(xmlWriter, elem, options, folderName, sequence) {
        var self = this
        var line = ''
        var normal_fields = []
        var o2m_fields = []
        var m2o_fields = []
        var m2m_fields = []
        var addonName = options.addonName // namespace
        var odooVersion = options.odooVersion
        var model_name_underscore = this.getModelName(elem, options, '_')
        var model_name_dot = this.getModelName(elem, options, '.')
        var model_name_title = this.sentenceCase(elem.name, options)
        var date_field_exist = false
        var date_field = ''
        var image_field_exist = false
        var state_field_exist = false
        var is_inherit = self.checkInherit(elem)
        var elem_name = elem.name

        var ref_tree = ''
        var ref_form = ''
        var ref_search = ''
        if (is_inherit) {
            if (model_name_dot == 'res.partner') {
                ref_tree = 'base.view_partner_tree'
                ref_form = 'base.view_partner_form'
                ref_search = 'base.view_res_partner_filter'
            } else if (model_name_dot == 'res.users') {
                ref_tree = 'base.view_users_tree'
                ref_form = 'base.view_users_form'
                ref_search = 'base.view_users_search'
            } else if (model_name_dot == 'res.currency') {
                ref_tree = 'base.view_currency_tree'
                ref_form = 'base.view_currency_form'
                ref_search = 'base.view_currency_search'
            } else if (model_name_dot == 'account.account') {
                ref_tree = 'account.view_account_list'
                ref_form = 'account.view_account_form'
                ref_search = 'account.view_account_search'
            } else if (model_name_dot == 'account.journal') {
                ref_tree = 'account.view_account_journal_tree'
                ref_form = 'account.view_account_journal_form'
                ref_search = 'account.view_account_journal_search'
            } else if (model_name_dot == 'hr.employee') {
                ref_tree = 'hr.view_employee_tree'
                ref_form = 'hr.view_employee_form'
                ref_search = 'hr.view_employee_filter'
            }
        } else {
            ref_tree = folderName + '.view_' + model_name_underscore + '_tree'
            ref_form = folderName + '.view_' + model_name_underscore + '_form'
            ref_search = folderName + '.view_' + model_name_underscore + '_search'
        }

        // get fields names
        elem.attributes.forEach(function(attr) {
            if (attr.name !== '' && attr.name !== undefined && attr.name != '_name' && attr.name != '_inherit') {
                normal_fields.push(attr)

                if (attr.type === 'Date' || attr.type === 'Datetime') {
                    date_field_exist = true
                    date_field = attr.name
                }
                if (attr.name === 'image_small') {
                    image_field_exist = true
                }

                if (attr.name === 'state') {
                    state_field_exist = true
                }

            }
        })

        var associations = app.repository.getRelationshipsOf(elem, function(rel) {
                return (rel instanceof type.UMLAssociation)
            })
            //looping associations
        for (var i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
                // if (asso.end1.reference === elem && asso.end2.navigable === true) {
            if (asso.end1.reference === elem) {
                // end1 = class ini => Many2one
                if (asso.end1.name !== "" && asso.end1.name !== undefined) {
                    if (asso.end1.multiplicity == '0..*' || asso.end1.multiplicity == '1..*') {
                        m2o_fields.push(asso.end1)
                    } else if (asso.end1.multiplicity == '*') {
                        m2m_fields.push(asso.end1)
                    }

                }
            }
            // if (asso.end2.reference === elem && asso.end1.navigable === true) {
            if (asso.end2.reference === elem) {
                // end2 = class ini => One2many
                if (asso.end2.name !== "" && asso.end2.name !== undefined) {
                    // console.log(asso.end2)
                    if (asso.end2.multiplicity == '1') {
                        o2m_fields.push(asso.end2)
                    } else if (asso.end2.multiplicity == '*') {
                        m2m_fields.push(asso.end2)
                    }
                }
            }
        }



        xmlWriter.writeLine('<?xml version="1.0" encoding="utf-8"?>')
        xmlWriter.writeLine('<odoo>')
        xmlWriter.indent()
        xmlWriter.writeLine('<data>')
        xmlWriter.indent()
        xmlWriter.writeLine('<!-- tree view -->')
        xmlWriter.writeLine('<!--record id="view_' + elem_name + '_tree" model="ir.ui.view">')
        xmlWriter.indent()
        xmlWriter.writeLine('<field name="name">' + elem_name + '_tree</field>')
        xmlWriter.writeLine('<field name="model">' + model_name_dot + '</field>')
        xmlWriter.writeLine('<field name="type">tree</field>')
        xmlWriter.writeLine('<field name="inherit_id" ref="' + ref_tree + '"/>')
        xmlWriter.writeLine('<field name="arch" type="xml">')
        xmlWriter.indent()

        xmlWriter.outdent()
        xmlWriter.writeLine('</field>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</record-->')

        xmlWriter.writeLine('<!-- form view -->')
        xmlWriter.writeLine('<record id="view_' + elem_name + '_form" model="ir.ui.view">')
        xmlWriter.indent()
        xmlWriter.writeLine('<field name="name">' + elem_name + '_form</field>')
        xmlWriter.writeLine('<field name="model">' + model_name_dot + '</field>')
        xmlWriter.writeLine('<field name="type">form</field>')
        xmlWriter.writeLine('<field name="inherit_id" ref="' + ref_form + '"/>')
        xmlWriter.writeLine('<field name="arch" type="xml">')
        xmlWriter.indent()

        xmlWriter.outdent()
        xmlWriter.writeLine('</field>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</record>')





        xmlWriter.writeLine('<!-- search -->')
        xmlWriter.writeLine('<!--record id="view_' + elem_name + '_search" model="ir.ui.view">')
        xmlWriter.indent()
        xmlWriter.writeLine('<field name="name">' + elem_name + '</field>')
        xmlWriter.writeLine('<field name="model">' + model_name_dot + '</field>')
        xmlWriter.writeLine('<field name="inherit_id" ref="' + ref_search + '"/>')
        xmlWriter.writeLine('<field name="arch" type="xml">')
        xmlWriter.indent()
        xmlWriter.outdent()
        xmlWriter.writeLine('</field>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</record-->')


        // actions
        if (model_name_underscore != 'res_users') {

            xmlWriter.writeLine('<!-- action window -->')

            xmlWriter.writeLine('<record id="' + folderName + '.action_' + elem_name + '" model="ir.actions.act_window">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + model_name_title + '</field>')
            xmlWriter.writeLine('<field name="type">ir.actions.act_window</field>')
            xmlWriter.writeLine('<field name="res_model">' + model_name_dot + '</field>')
            if (odooVersion < 12) {
                xmlWriter.writeLine('<field name="view_type">form</field>')
            }
            line = '<field name="view_mode">tree,form'

            if (!is_inherit) {
                line += ',kanban,pivot'
                if (date_field_exist) {
                    line += ',calendar'
                }
                if (m2o_fields.length > 0) {
                    line += ',graph'
                }
            }
            line += '</field>'
            xmlWriter.writeLine(line)
            xmlWriter.writeLine('<field name="context">{"search_default_fieldname":1}</field>')
            xmlWriter.writeLine('<field name="domain">[]</field>')
            xmlWriter.writeLine('<field name="help" type="html">')
            xmlWriter.indent()
            xmlWriter.writeLine('<p class="oe_view_nocontent_create">')
            xmlWriter.writeLine('Click to add a new ' + model_name_title)
            xmlWriter.writeLine('</p><p>')
            xmlWriter.writeLine('Click the Create button to add a new ' + model_name_title)
            xmlWriter.writeLine('</p>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')

            xmlWriter.writeLine()
            var parentMenu = ''
            if (state_field_exist)
                parentMenu = folderName + '.' + folderName + '_sub_menu'
            else
                parentMenu = folderName + '.' + folderName + '_config_menu'
            xmlWriter.writeLine('<menuitem active="1" id="' + folderName + '.menu_' + elem_name + '" name="' + model_name_title + '" parent="' + parentMenu + '" action="' + folderName + '.action_' + elem_name + '" sequence="' + sequence + '"/>')
        } // not res.users        

        xmlWriter.outdent()
        xmlWriter.writeLine('</data>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</odoo>')
    }


    writeSequenceXML(basePath, elem, options, isInheritedModule, folderName) {
        var state_field_exist = false
        elem.attributes.forEach(function(attr) {
            if (attr.name === 'state') {
                state_field_exist = true
            }
        })

        if (!state_field_exist)
            return

        var fullPath = basePath + '/data/sequence_' + elem.name + '.xml'
        var xmlWriter = new codegen.CodeWriter(this.getIndentString(options))
        var self = this
        var line = ''

        var addonName = options.addonName
        var model_name_underscore = this.getModelName(elem, options, '_')
        var model_name_dot = this.getModelName(elem, options, '.')
        var model_name_title = this.sentenceCase(elem.name, options)
        var date_field_exist = false
        var date_field = ''
        var image_field_exist = false

        var sequence_name = 'sequence_' + elem.name


        xmlWriter.writeLine('<?xml version="1.0" encoding="utf-8"?>')
        xmlWriter.writeLine('<odoo>')
        xmlWriter.indent()

        if (isInheritedModule) {
            xmlWriter.writeLine('<data >')
            xmlWriter.indent()
            xmlWriter.writeLine('<function name="write" model="ir.model.data">')
            xmlWriter.indent()
            xmlWriter.writeLine('<function name="search" model="ir.model.data">')
            xmlWriter.indent()
            xmlWriter.writeLine('<value eval="[(\'module\', \'=\', \'' + folderName + '\'), (\'name\', \'=\', \'' + sequence_name + '\')]"/>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</function>')
            xmlWriter.writeLine('<value eval="{\'noupdate\': False}" /> ')
            xmlWriter.outdent()
            xmlWriter.writeLine('</function>')

            xmlWriter.writeLine('<record id="' + folderName + '.' + sequence_name + '" model="ir.sequence">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + sequence_name + '</field>')
            xmlWriter.writeLine('<field name="code">' + model_name_dot + '</field>')
            xmlWriter.writeLine('<field name="prefix">X/%(year)s/%(month)s/</field>')
            xmlWriter.writeLine('<field name="padding">3</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')

            xmlWriter.writeLine('<function name="write" model="ir.model.data">')
            xmlWriter.indent()
            xmlWriter.writeLine('<function name="search" model="ir.model.data">')
            xmlWriter.indent()
            xmlWriter.writeLine('<value eval="[(\'module\', \'=\', \'' + folderName + '\'), (\'name\', \'=\', \'' + sequence_name + '\')]"/>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</function>')
            xmlWriter.writeLine('<value eval="{\'noupdate\': True}" />')
            xmlWriter.outdent()
            xmlWriter.writeLine('</function>')

        } else { //main modiule

            xmlWriter.writeLine('<data noupdate="1">')
            xmlWriter.indent()

            xmlWriter.writeLine('<record id="' + sequence_name + '" model="ir.sequence">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + sequence_name + '</field>')
            xmlWriter.writeLine('<field name="code">' + model_name_dot + '</field>')
            xmlWriter.writeLine('<field name="prefix">' + model_name_title.slice(0, 3).toUpperCase() + '/%(year)s/%(month)s/</field>')
            xmlWriter.writeLine('<field name="padding">3</field>')
            xmlWriter.writeLine('<field name="number_next_actual">1</field>')
            xmlWriter.writeLine('<field name="number_increment">1</field>')
            xmlWriter.writeLine('<field name="implementation">standard</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')

        }

        xmlWriter.outdent()
        xmlWriter.writeLine('</data>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</odoo>')

        fs.writeFileSync(fullPath, xmlWriter.getData())

    }

    writeReport(xmlWriter, elem, options, folderName) {

        var self = this
        var line = ''
        var normal_fields = []
        var o2m_fields = []
        var m2o_fields = []
        var addonName = options.addonName
        var model_name_underscore = this.getModelName(elem, options, '_')
        var model_name_dot = this.getModelName(elem, options, '.')
        var model_name_title = this.sentenceCase(elem.name, options)
        var date_field_exist = false
        var date_field = ''
        var image_field_exist = false
        var odooVersion = options.odooVersion

        // get fields names
        elem.attributes.forEach(function(attr) {
            if (attr.name !== '' && attr.name !== undefined && attr.name != '_name' && attr.name != '_inherit') {
                normal_fields.push(attr)

                if (attr.type === 'Date' || attr.type === 'Datetime') {
                    date_field_exist = true
                    date_field = attr.name
                }
                if (attr.name === 'image_small') {
                    image_field_exist = true
                }

            }
        })

        var associations = app.repository.getRelationshipsOf(elem, function(rel) {
                return (rel instanceof type.UMLAssociation)
            })
            //looping associations
        for (var i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
                // if (asso.end1.reference === elem && asso.end2.navigable === true) {
            if (asso.end1.reference === elem) {
                // end1 = class ini => Many2one
                if (asso.end1.name !== "" && asso.end1.name !== undefined) {
                    m2o_fields.push(asso.end1)
                }
            }
            // if (asso.end2.reference === elem && asso.end1.navigable === true) {
            if (asso.end2.reference === elem) {
                // end2 = class ini => One2many
                if (asso.end2.name !== "" && asso.end2.name !== undefined) {
                    o2m_fields.push(asso.end2)
                }
            }
        }

        xmlWriter.writeLine('<?xml version="1.0" encoding="utf-8"?>')
        xmlWriter.writeLine('<odoo>')
        xmlWriter.indent()
        xmlWriter.writeLine('<data>')
        xmlWriter.indent()

        xmlWriter.writeLine('<!-- report qweb view -->')

        if (odooVersion < 13) {
            xmlWriter.writeLine('<report id="report_' + model_name_underscore + '_menu" string="' + this.sentenceCase(addonName, options) + ' - ' + model_name_title + '"')
            xmlWriter.writeLine(' model="' + model_name_dot + '" report_type="qweb-pdf" ')
            xmlWriter.writeLine(' file="' + model_name_dot + '"  name="' + folderName + '.' + model_name_underscore + '_report" />')
            xmlWriter.writeLine()
        } else {
            xmlWriter.writeLine('<record id="action_report_' + model_name_underscore + '" model="ir.actions.report">')
            xmlWriter.indent()
            xmlWriter.writeLine('<field name="name">' + model_name_title + '</field>')
            xmlWriter.writeLine('<field name="model">' + model_name_dot + '</field>')
            xmlWriter.writeLine('<field name="report_type">qweb-pdf</field>')
            xmlWriter.writeLine('<field name="report_name">' + folderName + '.' + model_name_underscore + '_report</field>')
            xmlWriter.writeLine('<field name="report_file">' + folderName + '.' + model_name_underscore + '_report</field>')
            xmlWriter.writeLine('<field name="print_report_name">object.name</field>')
            xmlWriter.writeLine('<field name="binding_model_id" ref="' + folderName + '.model_' + model_name_underscore + '"/>')
            xmlWriter.writeLine('<field name="binding_type">report</field>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</record>')
        }


        xmlWriter.writeLine('<!-- document template -->')
        xmlWriter.writeLine('<template id="' + folderName + '.' + model_name_underscore + '_report_document" >')
        xmlWriter.indent()
        xmlWriter.writeLine('<t t-call="web.external_layout">')
        xmlWriter.indent()
        xmlWriter.writeLine(`<t t-set="doc" t-value="doc.with_context({'lang': lang})"/>`)
        xmlWriter.writeLine('<div class="page">')
        xmlWriter.indent()

        xmlWriter.writeLine('<h2>')
        xmlWriter.indent()
        xmlWriter.writeLine(model_name_title + ': <span t-field="doc.name"/>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</h2>')

        xmlWriter.writeLine('<div class="row mt32 mb32">')
        xmlWriter.indent()
        normal_fields.forEach(function(field) {
            if (field.name !== 'name') {
                xmlWriter.writeLine('<div class="col-auto mw-100 mb-2">')
                xmlWriter.indent()
                xmlWriter.writeLine('<strong>' + self.sentenceCase(field.name, options) + '</strong>')
                if (field.name == 'image_small') {
                    xmlWriter.writeLine(`<img alt="" class="m-0" style="width:100px" t-attf-src="data:image/*;base64,{{doc.` + field.name + `}}" />`)
                } else if (field.type != 'Binary') {
                    xmlWriter.writeLine('<p class="m-0" t-field="doc.' + field.name + '" />')
                }
                xmlWriter.outdent()
                xmlWriter.writeLine('</div>')
            }
        })
        m2o_fields.forEach(function(field) {
            xmlWriter.writeLine('<div class="col-auto mw-100 mb-2">')
            xmlWriter.indent()
            xmlWriter.writeLine('<strong>' + self.sentenceCase(field.name, options) + '</strong>')
            xmlWriter.writeLine('<p class="m-0" t-field="doc.' + field.name + '"/>')
            xmlWriter.outdent()
            xmlWriter.writeLine('</div>')
        })
        xmlWriter.outdent()

        xmlWriter.writeLine('</div>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</div>')

        xmlWriter.writeLine('<div class="oe_structure"/>')


        o2m_fields.forEach(function(field) {
            var comodel_normal_fields = field._parent.end1.reference.attributes
            var comodel_m2o_fields = []

            var end1 = field._parent.end1.reference
            var associations = app.repository.getRelationshipsOf(end1, function(rel) {
                return (rel instanceof type.UMLAssociation)
            })
            xmlWriter.writeLine('<h2>' + self.sentenceCase(field.name, options) + '</h2>')

            //looping associations
            for (var i = 0, len = associations.length; i < len; i++) {
                var asso = associations[i]
                    // if (asso.end1.reference === end1 && asso.end2.navigable === true) {
                if (asso.end1.reference === end1) {
                    // end1 = class ini => Many2one
                    if (asso.end1.name !== "" && asso.end1.name !== undefined) {
                        comodel_m2o_fields.push(asso.end1)
                    }
                }
            }
            console.log(comodel_m2o_fields)

            xmlWriter.writeLine(`<table class="table table-sm o_main_table" name="` + field.name + `_table">`)
            xmlWriter.indent()
            xmlWriter.writeLine(`<thead>`)
            xmlWriter.indent()
            xmlWriter.writeLine(`<tr>`)
            xmlWriter.indent()
            comodel_normal_fields.forEach(function(f) {
                xmlWriter.writeLine('<td>' + self.sentenceCase(f.name, options) + '</td>')
            })
            comodel_m2o_fields.forEach(function(f) {
                xmlWriter.writeLine('<td>' + self.sentenceCase(f.name, options) + '</td>')
            })
            xmlWriter.outdent()
            xmlWriter.writeLine(`</tr>`)
            xmlWriter.outdent()
            xmlWriter.writeLine(`</thead>`)
            xmlWriter.writeLine(`<tbody class="` + field.name + `_tbody">`)
            xmlWriter.indent()
            xmlWriter.writeLine(`<tr t-foreach="doc.` + field.name + `" t-as="line">`)
            xmlWriter.indent()
            comodel_normal_fields.forEach(function(f) {
                xmlWriter.writeLine('<td><span t-field="line.' + f.name + '" /></td>')
            })
            comodel_m2o_fields.forEach(function(f) {
                xmlWriter.writeLine('<td><span t-field="line.' + f.name + '" /></td>')
            })
            xmlWriter.outdent()
            xmlWriter.writeLine(`</tr> <!-- foreach-->`)
            xmlWriter.outdent()
            xmlWriter.writeLine(`</tbody>`)
            xmlWriter.outdent()
            xmlWriter.writeLine(`</table>`)
            xmlWriter.writeLine('<div class="oe_structure"/>')
        })


        xmlWriter.outdent()
        xmlWriter.writeLine('</t>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</template>')

        xmlWriter.writeLine()
        xmlWriter.writeLine('<!-- main template -->')
        xmlWriter.writeLine('<template id="' + folderName + '.' + model_name_underscore + '_report">')
        xmlWriter.indent()
        xmlWriter.writeLine('<t t-call="web.html_container">')
        xmlWriter.indent()
        xmlWriter.writeLine('<t t-foreach="docs" t-as="doc">')
        xmlWriter.indent()
        xmlWriter.writeLine('<t t-set="lang" t-value="doc.create_uid.lang"/>')
        xmlWriter.writeLine('<t t-call="' + folderName + '.' + model_name_underscore + '_report_document" />')
        xmlWriter.outdent()
        xmlWriter.writeLine('</t>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</t>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</template>')
        xmlWriter.writeLine()

        xmlWriter.outdent()
        xmlWriter.writeLine('</data>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</odoo>')
    }

    writeTopMenuXML(xmlWriter, options, folderName) {
        var addonName = folderName
        var appName = options.appName
        var line = ''

        xmlWriter.writeLine('<odoo>')
        xmlWriter.indent()
        xmlWriter.writeLine('<data>')
        xmlWriter.indent()

        line = '<menuitem id="' + addonName + '_top_menu" '
        line += 'name="' + appName + '" '
        line += 'sequence="20" '
        line += 'web_icon="' + addonName + ',static/description/icon.png" '
        line += '/>'

        xmlWriter.writeLine(line)


        line = '<menuitem id="' + addonName + '_sub_menu" '
        line += 'name="Operations" '
        line += 'sequence="40" '
        line += 'parent="' + addonName + '_top_menu" '
        line += '/>'
        xmlWriter.writeLine(line)

        line = '<menuitem id="' + addonName + '_config_menu" '
        line += 'name="Configurations" '
        line += 'sequence="50" '
        line += 'parent="' + addonName + '_top_menu" '
        line += '/>'
        xmlWriter.writeLine(line)

        xmlWriter.outdent()
        xmlWriter.writeLine('</data>')
        xmlWriter.outdent()
        xmlWriter.writeLine('</odoo>')
    }

    /**
     * Generate codes from a given element
     * @param {type.Model} elem
     * @param {string} path
     * @param {Object} options
     */
    generate(elem, basePath, options, folderName, inheritedModule, sequence) {

        var result = new $.Deferred()
        var fullPath, codeWriter, xmlWriter, file


        // Package (a directory with __init__.py)
        if (elem instanceof type.UMLPackage) {
            fullPath = path.join(basePath, elem.name)
            fs.mkdirSync(fullPath)
            file = path.join(fullPath, '__init__.py')
            fs.writeFileSync(file, '')
            elem.ownedElements.forEach(child => {
                this.generate(child, fullPath, options)
            })

            // Class for each diagram elements
        } else if (elem instanceof type.UMLClass || elem instanceof type.UMLInterface) {

            /// generate py----------------------------
            fullPath = basePath + '/model/' + elem.name + '.py'
            codeWriter = new codegen.CodeWriter(this.getIndentString(options))
            codeWriter.writeLine(options.installPath)
            codeWriter.writeLine('#-*- coding: utf-8 -*-')
            codeWriter.writeLine()


            this.writeClass(codeWriter, elem, options)

            fs.writeFileSync(fullPath, codeWriter.getData());
            /// end generate py -------------------------

            // if (!inheritedModule) {
            // generate view XML  -------------------------------
            fullPath = basePath + '/view/' + elem.name + '.xml'
            xmlWriter = new codegen.CodeWriter(this.getIndentString(options))
            this.writeXML(xmlWriter, elem, options, folderName, sequence)
            fs.writeFileSync(fullPath, xmlWriter.getData())

            /// generate qweb XML-----------------------------------
            fullPath = basePath + '/report/' + elem.name + '.xml'
            xmlWriter = new codegen.CodeWriter(this.getIndentString(options))
            this.writeReport(xmlWriter, elem, options, folderName)
            fs.writeFileSync(fullPath, xmlWriter.getData())

            //generate sequences with noupadte=True ------------------------------------
            this.writeSequenceXML(basePath, elem, options, false, folderName);
            // }

            // Enum
        } else if (elem instanceof type.UMLEnumeration) {
            fullPath = basePath + '/' + elem.name + '.py'
            codeWriter = new codegen.CodeWriter(this.getIndentString(options))
            codeWriter.writeLine(options.installPath)
            codeWriter.writeLine('#-*- coding: utf-8 -*-')
            codeWriter.writeLine()
            this.writeEnum(codeWriter, elem, options)
            fs.writeFileSync(fullPath, codeWriter.getData())

            // Others (Nothing generated.)
        } else {
            result.resolve()
        }
        return result.promise()
    }

    lowerFirst(string) {
        return string.replace(/^[A-Z]/, function(m) {
            return m.toLowerCase();
        });
    }

    kebabCase(string) {
        return this.lowerFirst(string).replace(/([A-Z])/g, function(m, g) {
            return '-' + g.toLowerCase();
        }).replace(/[\s\-_]+/g, '-');
    }

    capitalise(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    sentenceCase(string, options) {
        var english = options.en_language
        var res = this.capitalise(this.kebabCase(string).replace(/(-)/g, ' '));
        if (english)
            return res.replace(/ ids/g, 's').replace(/ id/g, '')
        else
            return res.replace(/ ids/g, '').replace(/ id/g, '')
    }


    getModelName(elem, options, separator) {
        var _name_value = ''
        var has_name = false
        var addonName = options.addonName

        elem.attributes.forEach(function(attr) {
            if (attr.name == "_name") {
                has_name = true
                _name_value = attr.defaultValue

                if (separator == '_') {
                    var res = _name_value.split(".")
                    _name_value = res[0] + separator + res[1]
                }

            }
        })

        if (!has_name) {
            if (!separator) {
                separator = '.'
            }
            _name_value = addonName + separator + elem.name
        }

        return _name_value
    }

    checkInherit(elem) {
        var is_inherit = false
        var BreakException = {};
        try {
            elem.attributes.forEach(function(attr) {
                if (attr.name === '_name' || attr.name === '_inherit') {
                    is_inherit = true
                    throw BreakException
                } else {
                    is_inherit = false
                }
            })
        } catch (e) {
            if (e !== BreakException) throw e;
        }

        return is_inherit

    }
}

/**
 * Generate
 * @param {type.Model} baseModel
 * @param {string} basePath
 * @param {Object} options
 */
function generate(baseModel, basePath, options) {
    var fullPath, xmlWriter
    var iconName = options.iconName

    // -------- write main addon folders
    var odooCodeGenerator = new OdooCodeGenerator(baseModel, basePath)
    fullPath = basePath + '/' + baseModel.name
    fs.mkdirSync(fullPath)
    fs.mkdirSync(fullPath + '/model')
    fs.mkdirSync(fullPath + '/view')
    fs.mkdirSync(fullPath + '/security')
    fs.mkdirSync(fullPath + '/report')
    fs.mkdirSync(fullPath + '/static')
    fs.mkdirSync(fullPath + '/static/description')
    fs.mkdirSync(fullPath + '/static/js')
    fs.mkdirSync(fullPath + '/static/xml')
    fs.mkdirSync(fullPath + '/data')

    //--------- copy menu icon 
    fs.copyFile(__dirname + "/icons/" + iconName + ".png", fullPath + '/static/description/icon.png', function(err) {
        if (err) throw err
        console.log('done copy')
    })


    // ------------- write app top menu 
    xmlWriter = new codegen.CodeWriter('\t')
    odooCodeGenerator.writeTopMenuXML(xmlWriter, options, baseModel.name)
    fs.writeFileSync(fullPath + '/view/menu.xml', xmlWriter.getData())

    // ---------------- write __manifetst__
    codeWriter = new codegen.CodeWriter('\t')
    odooCodeGenerator.writeManifest(codeWriter, baseModel.ownedElements, options, baseModel.name, false)
    fs.writeFileSync(fullPath + '/__manifest__.py', codeWriter.getData())

    // --------------- write __init__.py on addon folder
    codeWriter = new codegen.CodeWriter('\t')
    codeWriter.writeLine(options.installPath)
    codeWriter.writeLine('from . import model')
    fs.writeFileSync(fullPath + '/__init__.py', codeWriter.getData())

    // ---------------- write ir.model.access.csv on security folder

    odooCodeGenerator.writeModelAccess(fullPath, baseModel.ownedElements, baseModel.name, options)


    // ---------------- write groups.xml on security folder
    odooCodeGenerator.writeGroupsXML(fullPath, options)

    // ---------------- write __init__.py on model folder
    codeWriter = new codegen.CodeWriter('\t')
    codeWriter.writeLine(options.installPath)
    odooCodeGenerator.writeInit(codeWriter, baseModel.ownedElements, options)
    fs.writeFileSync(fullPath + '/model/__init__.py', codeWriter.getData())

    // ---------------- generate py files for each elements
    var sequence = 10
    baseModel.ownedElements.forEach(child => {
        odooCodeGenerator.generate(child, fullPath, options, baseModel.name, false, sequence)
        sequence += 10
    })




}

exports.generate = generate