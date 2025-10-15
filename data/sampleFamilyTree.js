// Sample family tree data
const familyTree = {
    name: "John Doe",
    children: [
        {
            name: "Jane Doe",
            children: [
                { name: "Alice Doe", children: [] },
                { name: "Bob Doe", children: [] }
            ]
        },
        {
            name: "Jack Doe",
            children: [
                { name: "Charlie Doe", children: [] }
            ]
        }
    ]
};

module.exports = familyTree;