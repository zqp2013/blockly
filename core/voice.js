/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2012 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Utility functions for handling slots.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Voice');

goog.require('Blockly.Blocks');
goog.require('Blockly.Field');
goog.require('Blockly.Names');
goog.require('Blockly.Workspace');


/**
 * Category to separate voice (slot/intent) names from variables and 
 * generated functions.
 */
Blockly.Voice.NAME_TYPE = 'VOICE';

/**
 * Find all user-created slot definitions in a workspace.
 * @param {!Blockly.Workspace} root Root workspace.
 * 
 * todo(jess): change from pair of arrays to single array for slots
//  * @return {!Array.<!Array.<!Array>>} Pair of arrays, the
//  *     first contains slots without return variables, the second with.
//  *     Each procedure is defined by a three-element list of name, parameter
//  *     list, and return value boolean.
 @return {!Array.<!Array>} An array of all slots. Each slot is defined by a 
 *     two-element list of slot name and slot type.
 */
Blockly.Voice.allSlots = function (root) {
    var blocks = root.getAllBlocks();
    var slots = [];
    for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].getSlotDef) {
            var tuple = blocks[i].getSlotDef();
            if (tuple) {
                slots.push(tuple);
            }
        }
    }
    slots.sort(Blockly.Voice.slotTupleComparator_);
    return [slots];
};

/**
 * Comparison function for case-insensitive sorting of the first element of
 * a tuple.
 * @param {!Array} ta First tuple.
 * @param {!Array} tb Second tuple.
 * @return {number} -1, 0, or 1 to signify greater than, equality, or less than.
 * @private
 */
Blockly.Voice.slotTupleComparator_ = function (ta, tb) {
    return ta[0].toLowerCase().localeCompare(tb[0].toLowerCase());
};

/**
 * Ensure two identically-named slots don't exist.
 * @param {string} name Proposed slot name.
 * @param {!Blockly.Block} block Block to disambiguate.
 * @return {string} Non-colliding name.
 */
Blockly.Voice.findLegalSlotName = function (name, block) {
    if (block.isInFlyout) {
        // Flyouts can have multiple slots called the same thing.
        // todo(jess): is this true for slots??
        return name;
    }
    name = name.replace(/\s+/g, '');
    while (!Blockly.Voice.isLegalName_(name, block.workspace, block)) {
        // Collision with another slot.
        var r = name.match(/^(.*?)(\d+)$/);
        if (!r) {
            name += '2';
        } else {
            name = r[1] + (parseInt(r[2], 10) + 1);
        }
    }
    return name;
};

/**
 * Does this slot have a legal name?  Illegal names include names of
 * slots already defined or names not meeting the requirements from Amazon:
 * "The name of a custom slot type must begin with an alphabetic character 
 * and can consist only of alphabetic characters or underscores."
 * @param {string} name The questionable name.
 * @param {!Blockly.Workspace} workspace The workspace to scan for collisions.
 * @param {Blockly.Block=} opt_exclude Optional block to exclude from
 *     comparisons (one doesn't want to collide with oneself).
 * @return {boolean} True if the name is legal.
 * @private
 */
Blockly.Voice.isLegalName_ = function (name, workspace, opt_exclude) {
    var blocks = workspace.getAllBlocks();
    // Iterate through every block and check the name.
    for (var i = 0; i < blocks.length; i++) {
        if (blocks[i] == opt_exclude) {
            continue;
        }
        // todo(jess): "The name of a custom slot type must begin with an 
        // alphabetic character and can consist only of alphabetic characters
        // or underscores."
        if (blocks[i].getSlotDef) {
            var slotName = blocks[i].getSlotDef();
            if (Blockly.Names.equals(slotName[0], name)) {
                return false;
            }
        }
    }
    return true;
};

/**
 * Rename a procedure.  Called by the editable field.
 * @param {string} name The proposed new name.
 * @return {string} The accepted name.
 * @this {!Blockly.Field}
 */
Blockly.Voice.rename = function (name) {
    // Strip leading and trailing whitespace.
    name = name.replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
    // todo(jess): "The name of a custom slot type must begin with an 
    // alphabetic character and can consist only of alphabetic characters 
    // or underscores."

    // Ensure two identically-named procedures don't exist.
    var legalName = Blockly.Voice.findLegalSlotName(name, this.sourceBlock_);
    var oldName = this.text_;
    if (oldName != name && oldName != legalName) {
        // Rename any callers.
        var blocks = this.sourceBlock_.workspace.getAllBlocks();
        for (var i = 0; i < blocks.length; i++) {
            if (blocks[i].renameProcedure) {
                blocks[i].renameProcedure(oldName, legalName);
            }
        }
    }
    return legalName;
};

/**
 * Construct the blocks required by the flyout for the slot category.
 * @param {!Blockly.Workspace} workspace The workspace containing slots.
 * @return {!Array.<!Element>} Array of XML block elements.
 */
Blockly.Voice.flyoutCategory = function (workspace) {
    var xmlList = [];
    if (Blockly.Blocks['voice_define_any_slot']) {
        // <block type="slots" gap="16">
        //     <field name="NAME">do something</field>
        // </block>
        var block = goog.dom.createDom('block');
        block.setAttribute('type', 'voice_define_any_slot');
        block.setAttribute('gap', 16);
        var nameField = goog.dom.createDom('field', null, null);
            // Blockly.Msg.PROCEDURES_DEFNORETURN_PROCEDURE); todo(jess): blk msg
        nameField.setAttribute('slotName', 'SLOT_NAME');
        block.appendChild(nameField);
        xmlList.push(block);
    }
    if (xmlList.length) {
        // Add slightly larger gap between system blocks and user calls.
        xmlList[xmlList.length - 1].setAttribute('gap', 24);
    }

    function populateSlots(slotList, templateName) {
        // todo(jess): is this populating the drawer?
        for (var i = 0; i < slotList.length; i++) {
            var name = slotList[i][0];
            // Create a 'get slot' block:
            // <block type="voice_get_slot" gap="16">
            //   <mutation name="slotName">
            //   </mutation>
            // </block>
            var block = goog.dom.createDom('block');
            block.setAttribute('type', templateName);
            block.setAttribute('gap', 16);
            var mutation = goog.dom.createDom('mutation');
            mutation.setAttribute('SLOT_NAME', name);
            block.appendChild(mutation);
            xmlList.push(block);
        }
    }

    var tuple = Blockly.Voice.allSlots(workspace);
    populateSlots(tuple[0], 'voice_get_slot'); 
    return xmlList;
};

/**
 * todo(jess): procedure callers are equivalent to slot 'getters'
 * Find all the callers of a named slot.
 * @param {string} name Name of slot.
 * @param {!Blockly.Workspace} workspace The workspace to find callers in.
 * @return {!Array.<!Blockly.Block>} Array of caller blocks.
 */
Blockly.Voice.getSlotGetters = function (name, workspace) {
    var callers = [];
    var blocks = workspace.getAllBlocks();
    // Iterate through every block and check the name.
    for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].getSlotGetter) {
            var slotName = blocks[i].getSlotGetter();
            // Procedure name may be null if the block is only half-built.
            if (slotName && Blockly.Names.equals(slotName, name)) {
                callers.push(blocks[i]);
            }
        }
    }
    return callers;
};

// /** todo(jess): should only be relevant to parameters... del?
//  * When a slot definition changes its parameters, find and edit all its
//  * callers.
//  * @param {!Blockly.Block} defBlock Procedure definition block.
//  */
// Blockly.Voice.mutateCallers = function (defBlock) {
//     var oldRecordUndo = Blockly.Events.recordUndo;
//     var name = defBlock.getSlotDef()[0];
//     var xmlElement = defBlock.mutationToDom(true);
//     var callers = Blockly.Voice.getSlotGetters(name, defBlock.workspace);
//     for (var i = 0, caller; caller = callers[i]; i++) {
//         var oldMutationDom = caller.mutationToDom();
//         var oldMutation = oldMutationDom && Blockly.Xml.domToText(oldMutationDom);
//         caller.domToMutation(xmlElement);
//         var newMutationDom = caller.mutationToDom();
//         var newMutation = newMutationDom && Blockly.Xml.domToText(newMutationDom);
//         if (oldMutation != newMutation) {
//             // Fire a mutation on every caller block.  But don't record this as an
//             // undo action since it is deterministically tied to the procedure's
//             // definition mutation.
//             Blockly.Events.recordUndo = false;
//             Blockly.Events.fire(new Blockly.Events.Change(
//                 caller, 'mutation', null, oldMutation, newMutation));
//             Blockly.Events.recordUndo = oldRecordUndo;
//         }
//     }
// };

/**
 * Find the definition block for the named procedure.
 * @param {string} name Name of procedure.
 * @param {!Blockly.Workspace} workspace The workspace to search.
 * @return {Blockly.Block} The procedure definition block, or null not found.
 */
Blockly.Voice.getDefinition = function (name, workspace) {
    // Assume that a procedure definition is a top block.
    var blocks = workspace.getTopBlocks(false);
    for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].getSlotDef) {
            var tuple = blocks[i].getSlotDef();
            if (tuple && Blockly.Names.equals(tuple[0], name)) {
                return blocks[i];
            }
        }
    }
    return null;
};