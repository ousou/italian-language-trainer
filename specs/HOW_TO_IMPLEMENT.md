The user will tell you which file to read the specs from. If they haven't, ask them which spec to implement.

If there is anything unclear with any of the things in the spec that you're asked to implement, ask before continuing.
When the spec is clear to you, tell the user that you will start, and wait for them to tell you to proceed.

Then, write a plan for how to implement each of them, and write the plans to the folder plans/ in md format - one plan file per feature. 
Write the steps in the plans as checkboxes, and tick of a box when you have implemented that step.
After that, implement everything according to your plans, without asking the user to accept the plan. Only ask the user to go through the plans if they ask you to.
Commit often, and follow other guidance on how to run tests.
For every checklist item in the spec, create at least one dedicated commit before moving to the next item.
If a feature spans multiple areas, make additional incremental commits (logic/tests, UI, snapshots, docs).
Always commit before checking off the spec item, and include any related plan/spec updates in that commit unless the user asks otherwise.

When one feature/change from the original spec is done, check that off in the spec file, and move on to the next one. 
Don't pass the control back to the user until everything that was specified in the spec has been implemented.
