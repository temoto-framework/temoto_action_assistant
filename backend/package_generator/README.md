# temoto\_action\_designer

## Dependencies

`pip3 install Jinja2`

## Create action package

```bash
python package_generator/scripts/generate_package.py \
--umrf-json <PATH_TO_UMRF_JSON> \
--output <PATH_WHERE_THE_PACKAGE_IS_GENERATED> \
--templates package_generator/templates/ \
--framework <choose either 'CMake' or 'ROS2'>
```
