import json
import jinja2
import argparse
import os
import re
import shutil
import sys

# Define the JSON-to-C++ type mapping
TYPE_MAPPING = {
    "number": "double",
    "numbers": "std::vector<double>",
    "bool": "bool",
    "bools": "std::vector<bool>",
    "string": "std::string",
    "strings": "std::vector<std::string>"
}

def camel_to_snake(name):
    # Add an underscore before each uppercase letter except the first one
    snake = re.sub(r'(?<!^)(?=[A-Z])', '_', name)

    # Convert the result to lowercase
    return snake.lower()

def generate_cpp_structs(json_data, struct_name):
    """
    Recursively generate C++ structs from a JSON dictionary.
    """
    structs = []

    def process_object(obj, name):
        fields = []
        nested_structs = []

        for key, value in obj.items():

            if value.get("pvf_type") is None:
                # Handle nested objects recursively
                nested_struct_name = key + "_t"
                nested_structs.extend(process_object(value, nested_struct_name))
                fields.append((nested_struct_name, key))
            else:
                # Map JSON types to C++ types
                cpp_type = TYPE_MAPPING.get(value["pvf_type"])
                fields.append((cpp_type, key))

        # Add the current struct to the list
        structs.append({"name": name, "fields": fields})
        return nested_structs

    process_object(json_data, struct_name)
    return structs

def generate_get_input_param(json_data):
    '''
     Each element in this list is a dictionary, contatining following keys:

        * cpp_access: A data structure access string, e.g., "pose.position.x"
        * cpp_type: C++ data type, e.g, "double"
        * name: Full name of the parameter, e.g., "pose::position::x"

        For example: ({"cpp_access": "pose.position.x",
                       "cpp_type":   "double",
                       "name":  "pose::position::x"})
    '''
    lines = []

    def process_object(obj, name=""):
        for key, value in obj.items():
            cpp_access = ""

            if name:
                cpp_access = f"{name}.{key}"
            else:
                cpp_access = key

            if value.get("pvf_type") is None:
                process_object(value, cpp_access)
            else:
                cpp_type = TYPE_MAPPING.get(value["pvf_type"])
                pvf_name = cpp_access.replace(".", "::")
                lines.append({"cpp_access": cpp_access, "cpp_type": cpp_type, "name": pvf_name})

    process_object(json_data)
    return lines

def generate_set_output_param(json_data):
    '''
     Each element in this list is a dictionary, contatining following keys:

        * cpp_access: A data structure access string, e.g., "pose.position.x"
        * type: Data type outlined in the UMRF JSON, e.g., "number"
        * name: Full name of the parameter, e.g., "pose::position::x"

        For example: ({"cpp_access": "pose.position.x",
                       "type":       "number",
                       "name":       "pose::position::x"})
    '''
    lines = []

    def process_object(obj, name=""):
        for key, value in obj.items():
            cpp_access = ""

            if name:
                cpp_access = f"{name}.{key}"
            else:
                cpp_access = key

            if value.get("pvf_type") is None:
                process_object(value, cpp_access)
            else:
                pvf_name = cpp_access.replace(".", "::")
                pvf_type = value["pvf_type"]
                lines.append({"cpp_access": cpp_access, "type": pvf_type, "name": pvf_name})

    process_object(json_data)
    return lines

def generate_package(umrf_json_path, templates_path, output_path, framework):
    """
    Generate a package based on the UMRF JSON configuration.
    
    Args:
        umrf_json_path (str): Path to the UMRF JSON file
        templates_path (str): Path to Jinja2 templates
        output_path (str): Path to generate output files
        framework (str): Framework type ('CMake' or 'ROS2')
    
    Returns:
        str: Path to the generated package base directory
    """
    # Load the JSON
    with open(umrf_json_path) as f:
        json_data = json.load(f)

    # Create directories
    gen_path_base = os.path.join(output_path, camel_to_snake(json_data["name"]))
    gen_path_src = os.path.join(gen_path_base, 'src')
    gen_path_include = os.path.join(gen_path_base, 'include', camel_to_snake(json_data["name"]))

    if not os.path.exists(gen_path_src):
        os.makedirs(gen_path_src)

    if not os.path.exists(gen_path_include):
        os.makedirs(gen_path_include)

    # Copy the UMRF JSON file
    shutil.copyfile(umrf_json_path, os.path.join(gen_path_base, camel_to_snake(json_data["name"])) + '.umrf.json')

    # Load jinja templates
    templateLoader = jinja2.FileSystemLoader(searchpath=templates_path)
    templateEnv = jinja2.Environment(loader=templateLoader, trim_blocks=True, lstrip_blocks=True)

    # Select templates based on framework
    template_structs = templateEnv.get_template('param_structs.jinja')
    template_temoto_action = templateEnv.get_template('temoto_action.jinja')
    template_temoto_action_impl = templateEnv.get_template('temoto_action_impl.jinja')
    
    template_cmakelists = None
    template_packagexml = None

    if framework == "CMake":
        template_cmakelists = templateEnv.get_template('cmakelists.jinja')
    elif framework == "ROS2":
        template_cmakelists = templateEnv.get_template('cmakelists_ros2.jinja')
        template_packagexml = templateEnv.get_template('packagexml.jinja')
    else:
        raise ValueError(f'Unknown framework "{framework}"')

    # Render input parameter C++ structs
    gen_input_params = None
    if json_data.get("input_parameters") is not None:
        input_structs = generate_cpp_structs(json_data["input_parameters"], "input_parameters_t")
        render_cpp_input_param_structs = template_structs.render(structs=input_structs)

        with open(os.path.join(gen_path_include, "input_parameters.hpp"), "w") as f:
            f.write(render_cpp_input_param_structs)

        gen_input_params = generate_get_input_param(json_data["input_parameters"])

    # Render output parameter C++ structs
    gen_output_params = None
    if json_data.get("output_parameters") is not None:
        output_structs = generate_cpp_structs(json_data["output_parameters"], "output_parameters_t")
        render_cpp_output_param_structs = template_structs.render(structs=output_structs)

        with open(os.path.join(gen_path_include, "output_parameters.hpp"), "w") as f:
            f.write(render_cpp_output_param_structs)

        gen_output_params = generate_set_output_param(json_data["output_parameters"])

    # Render the temoto_action.hpp
    render_temoto_action = template_temoto_action.render(
        action_name=camel_to_snake(json_data["name"]),
        gen_input_params=gen_input_params,
        gen_output_params=gen_output_params
    )

    with open(os.path.join(gen_path_include, "temoto_action.hpp"), "w") as f:
        f.write(render_temoto_action)

    # Render the temoto_action_impl.cpp
    render_temoto_action_impl = template_temoto_action_impl.render(
        action_class_name=json_data["name"],
        action_package_name=camel_to_snake(json_data["name"])
    )

    with open(os.path.join(gen_path_src, camel_to_snake(json_data["name"]) + ".cpp"), "w") as f:
        f.write(render_temoto_action_impl)

    # Render the CMakeLists.txt
    render_cmakelists = template_cmakelists.render(
        action_package_name=camel_to_snake(json_data["name"])
    )

    with open(os.path.join(gen_path_base, "CMakeLists.txt"), "w") as f:
        f.write(render_cmakelists)

    # Render package.xml
    if template_packagexml is not None:
        render_packagexml = template_packagexml.render(
            action_package_name=camel_to_snake(json_data["name"])
        )

        with open(os.path.join(gen_path_base, "package.xml"), "w") as f:
            f.write(render_packagexml)

    return gen_path_base

def save_graph(graph_data, output_path):
    '''
    Save the graph data to the output path
    '''

    graph_name = graph_data["graph_name"]

    print (f'Saving graph to: {os.path.join(output_path, f"{graph_name}.umrf.graph.json")}')

    os.makedirs(output_path, exist_ok=True)
    with open(os.path.join(output_path, f"{graph_name}.umrf.graph.json"), "w") as f:
        json.dump(graph_data, f, indent=4)
    
    return output_path



def main():
    # Create the argument parser
    parser = argparse.ArgumentParser(description="Action package generator.")

    # Add arguments
    parser.add_argument("--umrf-json", type=str, required=True, help="Path to UMRF JSON.")
    parser.add_argument("--templates", type=str, required=True, help="Path to jinja templates.")
    parser.add_argument("--output", type=str, required=True, help="Path to generated output files.")
    parser.add_argument("--framework", type=str, required=True, help="CMake or ROS2 project.")

    # Parse the arguments
    args = parser.parse_args()

    # Call the generate_package function with command-line arguments
    generate_package(
        umrf_json_path=args.umrf_json,
        templates_path=args.templates,
        output_path=args.output,
        framework=args.framework
    )

if __name__ == "__main__":
    main()
