import Project, { VariableDeclarationKind, SyntaxKind, NewLineKind } from "ts-simple-ast";
import { getCompilerVersions } from "./getCompilerVersions";
import * as os from "os";

// get versions
const versions = getCompilerVersions();

// setup
const project = new Project({
    manipulationSettings: {
        newLineKind: os.EOL === "\n" ? NewLineKind.LineFeed : NewLineKind.CarriageReturnLineFeed
    }
});

// update compiler types file
const compilerVersionsFile = project.addExistingSourceFile("./src/compiler/compilerVersions.ts");
compilerVersionsFile.removeText();

compilerVersionsFile.addTypeAliases([{
    isExported: true,
    name: "compilerVersions",
    type: versions.map(v => `"${v.version}"`).join(" | ")
}, {
    isExported: true,
    name: "compilerPackageNames",
    type: versions.map(v => `"${v.name}"`).join(" | ")
}]);
compilerVersionsFile
    .addVariableStatement({
        isExported: true,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{ name: "compilerVersionCollection", initializer: "[]", type: "{ version: compilerVersions; packageName: compilerPackageNames; }[]" }]
    })
    .getDeclarations()[0]
    .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)
    .addElements(versions.map(v => `{ version: "${v.version}", packageName: "${v.name}" }`), { useNewLines: true });
compilerVersionsFile.addFunctions([{
    isExported: true,
    isAsync: true,
    name: "importCompilerApi",
    parameters: [{ name: "packageName", type: "compilerPackageNames" }],
    bodyText: writer => {
        writer.writeLine("// these explicit import statements are required to get webpack to include these modules");
        writer.write("switch (packageName)").block(() => {
            for (const version of versions) {
                writer.writeLine(`case "${version.name}":`);
                writer.indentBlock(() => {
                    writer.writeLine(`return await import("${version.name}");`);
                });
            }
            writer.writeLine(`default:`);
            writer.indentBlock(() => {
                writer.writeLine("const assertNever: never = packageName;")
                    .writeLine("throw new Error(`Not implemented version: ${packageName}`);");
            });
        });
    }
}, {
    isExported: true,
    isAsync: true,
    name: "immportLibFiles",
    parameters: [{ name: "packageName", type: "compilerPackageNames" }],
    bodyText: writer => {
        writer.writeLine("// these explicit import statements are required to get webpack to include these modules");
        writer.write("switch (packageName)").block(() => {
            for (const version of versions) {
                writer.writeLine(`case "${version.name}":`);
                writer.indentBlock(() => {
                    writer.writeLine(`return await import("../resources/libFiles/${version.name}/index");`);
                });
            }
            writer.writeLine(`default:`);
            writer.indentBlock(() => {
                writer.writeLine("const assertNever: never = packageName;")
                    .writeLine("throw new Error(`Not implemented version: ${packageName}`);");
            });
        });
    }
}]);
compilerVersionsFile.insertText(0, writer => {
    writer.writeLine("/* tslint:disable */").writeLine("/* Automatically maintained from package.json. Do not edit! */").newLine();
});

compilerVersionsFile.save();
